import { describe, it, expect, beforeAll } from 'vitest';
import { Issue } from '../models/Issue.js';
import { Notification } from '../models/Notification.js';
import { runSlaSweep } from '../jobs/sla.js';
import { runAutoClose } from '../jobs/autoClose.js';
import { makeUser } from './helpers.js';
import { makeIssue } from './fixtures.js';

const H = 36e5;
let admin, admin2, student, tech;

beforeAll(async () => {
  admin = await makeUser({ role: 'admin' });
  admin2 = await makeUser({ role: 'admin' });
  student = await makeUser();
  tech = await makeUser({ role: 'technician', skills: ['electrical'] });
});

describe('hourly SLA sweep (D2)', () => {
  it('escalates a newly overdue issue once and notifies every admin once', async () => {
    const created = new Date(Date.now() - 6 * H);
    const issue = await makeIssue(student.user, {
      severity: 'critical',
      createdAt: created,
      priorityScore: 100,
    });
    expect(issue.escalatedAt).toBeNull();

    const first = await runSlaSweep(new Date());
    expect(first.escalated).toBeGreaterThanOrEqual(1);
    const after = await Issue.findById(issue._id);
    expect(after.escalatedAt).toBeTruthy();
    expect(after.priorityScore).toBe(100 + 2 * 2); // 2 whole hours overdue
    for (const a of [admin, admin2]) {
      expect(
        await Notification.countDocuments({
          user: a.user._id,
          type: 'sla_overdue',
          issue: issue._id,
        }),
      ).toBe(1);
    }

    // an hour later: priority rises again but no second escalation
    const second = await runSlaSweep(new Date(Date.now() + H));
    expect(second.escalated).toBe(0);
    const later = await Issue.findById(issue._id);
    expect(later.priorityScore).toBe(100 + 2 * 3);
    expect(
      await Notification.countDocuments({
        user: admin.user._id,
        type: 'sla_overdue',
        issue: issue._id,
      }),
    ).toBe(1);
  });

  it('leaves issues within SLA and finished issues alone', async () => {
    const fresh = await makeIssue(student.user, { severity: 'low', priorityScore: 10 });
    const done = await makeIssue(student.user, {
      status: 'resolved',
      severity: 'critical',
      createdAt: new Date(Date.now() - 50 * H),
      priorityScore: 100,
      resolvedAt: new Date(),
    });
    await runSlaSweep();
    expect((await Issue.findById(fresh._id)).escalatedAt).toBeNull();
    const d = await Issue.findById(done._id);
    expect(d.escalatedAt).toBeNull();
    expect(d.priorityScore).toBe(100);
  });
});

describe('auto-close (D1)', () => {
  it('closes resolved issues after AUTO_CLOSE_HOURS as the system, and only those', async () => {
    const old = await makeIssue(student.user, {
      status: 'resolved',
      assignedTo: tech.user._id,
      resolvedAt: new Date(Date.now() - 73 * H),
      resolutionPhotoPath: '/uploads/a.jpg',
    });
    const recent = await makeIssue(student.user, {
      status: 'resolved',
      assignedTo: tech.user._id,
      resolvedAt: new Date(Date.now() - 10 * H),
      resolutionPhotoPath: '/uploads/b.jpg',
    });
    const open = await makeIssue(student.user, {
      status: 'open',
      createdAt: new Date(Date.now() - 100 * H),
    });

    const res = await runAutoClose(new Date(), 72);
    expect(res.closed).toBe(1);

    const closed = await Issue.findById(old._id);
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeTruthy();
    const last = closed.statusHistory.at(-1);
    expect(last.status).toBe('closed');
    expect(last.changedBy).toBeNull(); // the system
    expect(last.note).toMatch(/automatically/);
    expect((await Issue.findById(recent._id)).status).toBe('resolved');
    expect((await Issue.findById(open._id)).status).toBe('open');
    // reporter and technician are told
    expect(
      await Notification.exists({ user: student.user._id, issue: old._id, title: 'Fix confirmed' }),
    ).toBeTruthy();
    expect(
      await Notification.exists({ user: tech.user._id, issue: old._id, title: 'Fix confirmed' }),
    ).toBeTruthy();
  });

  it('is idempotent', async () => {
    expect((await runAutoClose(new Date(), 72)).closed).toBe(0);
  });
});
