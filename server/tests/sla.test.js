import { describe, it, expect } from 'vitest';
import {
  computeDueAt,
  computePriority,
  hoursOverdue,
  isOverdue,
  refreshSla,
  SLA_HOURS,
} from '../services/sla.js';

const H = 36e5;
const t0 = new Date('2026-10-01T08:00:00.000Z');

describe('SLA due dates (D2)', () => {
  it.each([
    ['critical', 4],
    ['high', 24],
    ['medium', 72],
    ['low', 168],
  ])('%s → %i hours', (severity, hours) => {
    expect(SLA_HOURS[severity]).toBe(hours);
    expect(computeDueAt(t0, severity).getTime() - t0.getTime()).toBe(hours * H);
  });
});

describe('overdue', () => {
  const issue = (status, dueAt) => ({ status, dueAt, severity: 'high', supporters: [] });

  it('is overdue only after dueAt and while the SLA clock runs', () => {
    const due = new Date(t0.getTime() + H);
    expect(isOverdue(issue('open', due), new Date(t0.getTime() + 30 * 60 * 1000))).toBe(false);
    expect(isOverdue(issue('open', due), due)).toBe(false); // exactly at dueAt is not yet overdue
    expect(isOverdue(issue('open', due), new Date(due.getTime() + 1))).toBe(true);
    for (const s of ['assigned', 'in_progress', 'reopened']) {
      expect(isOverdue(issue(s, due), new Date(due.getTime() + H))).toBe(true);
    }
    for (const s of ['resolved', 'closed', 'rejected']) {
      expect(isOverdue(issue(s, due), new Date(due.getTime() + H))).toBe(false);
    }
  });

  it('counts whole hours overdue', () => {
    const due = t0;
    expect(hoursOverdue(issue('open', due), new Date(t0.getTime() + 2.9 * H))).toBe(2);
  });
});

describe('priority score (D2)', () => {
  const base = { status: 'open', dueAt: new Date(t0.getTime() + 100 * H), supporters: [] };

  it('uses the severity weight', () => {
    expect(computePriority({ ...base, severity: 'critical' }, t0)).toBe(100);
    expect(computePriority({ ...base, severity: 'high' }, t0)).toBe(60);
    expect(computePriority({ ...base, severity: 'medium' }, t0)).toBe(30);
    expect(computePriority({ ...base, severity: 'low' }, t0)).toBe(10);
  });

  it('adds 8 per supporter', () => {
    expect(computePriority({ ...base, severity: 'medium', supporters: ['a', 'b', 'c'] }, t0)).toBe(
      30 + 24,
    );
  });

  it('adds 2 per hour overdue, capped at 48 hours', () => {
    const overdue = { ...base, severity: 'low', dueAt: t0 };
    expect(computePriority(overdue, new Date(t0.getTime() + 5 * H))).toBe(10 + 10);
    expect(computePriority(overdue, new Date(t0.getTime() + 48 * H))).toBe(10 + 96);
    expect(computePriority(overdue, new Date(t0.getTime() + 500 * H))).toBe(10 + 96);
  });

  it('combines everything', () => {
    const issue = { status: 'assigned', severity: 'high', supporters: ['a', 'b'], dueAt: t0 };
    expect(computePriority(issue, new Date(t0.getTime() + 10 * H))).toBe(60 + 16 + 20);
  });

  it('stops adding overdue weight once resolved', () => {
    const issue = { status: 'resolved', severity: 'high', supporters: [], dueAt: t0 };
    expect(computePriority(issue, new Date(t0.getTime() + 10 * H))).toBe(60);
  });
});

describe('refreshSla escalation', () => {
  it('reports the first time an issue becomes overdue, only once', () => {
    const issue = {
      status: 'open',
      severity: 'critical',
      supporters: [],
      dueAt: t0,
      escalatedAt: null,
    };
    expect(refreshSla(issue, new Date(t0.getTime() - H))).toBe(false);
    expect(issue.escalatedAt).toBeNull();
    const later = new Date(t0.getTime() + H);
    expect(refreshSla(issue, later)).toBe(true);
    expect(issue.escalatedAt).toEqual(later);
    expect(refreshSla(issue, new Date(t0.getTime() + 2 * H))).toBe(false);
    expect(issue.priorityScore).toBe(100 + 4);
  });
});
