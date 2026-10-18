import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { assertTransition, allowedTransitions } from '../utils/transitions.js';
import { STATUSES } from '../utils/constants.js';

/**
 * Exhaustive check of SPEC D1. The expected table below is written out by hand from the
 * spec (not derived from the implementation), then every (from, to, actor) combination is tried.
 */
const ALLOWED = [
  ['open', 'assigned', 'admin'],
  ['reopened', 'assigned', 'admin'],
  ['assigned', 'assigned', 'admin'],
  ['in_progress', 'assigned', 'admin'],
  ['assigned', 'in_progress', 'assignee'],
  ['in_progress', 'resolved', 'assignee'],
  ['resolved', 'closed', 'reporter'],
  ['resolved', 'closed', 'admin'],
  ['resolved', 'closed', 'system'],
  ['resolved', 'reopened', 'reporter'],
  ['open', 'rejected', 'admin'],
  ['reopened', 'rejected', 'admin'],
];
const TARGETS = ['assigned', 'in_progress', 'resolved', 'closed', 'reopened', 'rejected'];
const ACTORS = ['admin', 'assignee', 'reporter', 'otherStudent', 'otherTechnician', 'system'];

const oid = () => new mongoose.Types.ObjectId();
const ids = {
  admin: oid(),
  assignee: oid(),
  reporter: oid(),
  otherStudent: oid(),
  otherTechnician: oid(),
};
const actorOf = (name) =>
  ({
    admin: { _id: ids.admin, role: 'admin' },
    assignee: { _id: ids.assignee, role: 'technician' },
    reporter: { _id: ids.reporter, role: 'student' },
    otherStudent: { _id: ids.otherStudent, role: 'student' },
    otherTechnician: { _id: ids.otherTechnician, role: 'technician' },
    system: 'system',
  })[name];

const issueIn = (status, extra = {}) => ({
  status,
  reportedBy: ids.reporter,
  assignedTo: ids.assignee,
  resolvedAt: new Date(Date.now() - 60 * 60 * 1000),
  ...extra,
});

// Inputs that satisfy every "needs" so only from/who are being tested
const fullInput = {
  photo: { buffer: Buffer.from('x') },
  reason: 'Because',
  technician: { _id: oid(), role: 'technician', isActive: true },
};

function outcome(fn) {
  try {
    fn();
    return 'ok';
  } catch (err) {
    return err.status;
  }
}

describe('status transitions (SPEC D1) — every combination', () => {
  const isAllowed = (from, to, actor) =>
    ALLOWED.some(([f, t, a]) => f === from && t === to && a === actor);
  const fromAllowed = (from, to) => ALLOWED.some(([f, t]) => f === from && t === to);

  for (const from of STATUSES) {
    for (const to of TARGETS) {
      for (const actor of ACTORS) {
        const expected = isAllowed(from, to, actor) ? 'ok' : fromAllowed(from, to) ? 403 : 409;
        it(`${from} → ${to} by ${actor}: ${expected === 'ok' ? 'allowed' : expected}`, () => {
          const got = outcome(() =>
            assertTransition({ issue: issueIn(from), actor: actorOf(actor), to, input: fullInput }),
          );
          expect(got).toBe(expected);
        });
      }
    }
  }

  it('closed and rejected are terminal for everyone', () => {
    for (const from of ['closed', 'rejected']) {
      for (const actor of ACTORS) {
        expect(allowedTransitions(issueIn(from), actorOf(actor))).toEqual([]);
      }
    }
  });

  it('allowedTransitions matches the table', () => {
    for (const from of STATUSES) {
      for (const actor of ACTORS) {
        const expected = TARGETS.filter((to) => isAllowed(from, to, actor)).sort();
        expect(allowedTransitions(issueIn(from), actorOf(actor)).sort()).toEqual(expected);
      }
    }
  });
});

describe('transition conditions', () => {
  const assignee = actorOf('assignee');
  const reporter = actorOf('reporter');
  const admin = actorOf('admin');

  it('resolve requires an after photo (400)', () => {
    expect(
      outcome(() =>
        assertTransition({ issue: issueIn('in_progress'), actor: assignee, to: 'resolved' }),
      ),
    ).toBe(400);
  });

  it('reopen requires a reason (400)', () => {
    expect(
      outcome(() =>
        assertTransition({
          issue: issueIn('resolved'),
          actor: reporter,
          to: 'reopened',
          input: { reason: '   ' },
        }),
      ),
    ).toBe(400);
  });

  it('reopen is only possible within 7 days of resolution (409)', () => {
    const old = issueIn('resolved', { resolvedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) });
    let err;
    try {
      assertTransition({
        issue: old,
        actor: reporter,
        to: 'reopened',
        input: { reason: 'Still broken' },
      });
    } catch (e) {
      err = e;
    }
    expect(err.status).toBe(409);
    expect(err.code).toBe('REOPEN_WINDOW_CLOSED');
    expect(allowedTransitions(old, reporter)).toEqual(['closed']);
  });

  it('reopen on day 6 is fine', () => {
    const recent = issueIn('resolved', { resolvedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000) });
    expect(
      outcome(() =>
        assertTransition({
          issue: recent,
          actor: reporter,
          to: 'reopened',
          input: { reason: 'Leaking again' },
        }),
      ),
    ).toBe('ok');
  });

  it('reject requires a reason (400)', () => {
    expect(
      outcome(() => assertTransition({ issue: issueIn('open'), actor: admin, to: 'rejected' })),
    ).toBe(400);
  });

  it('assign requires an active technician (400)', () => {
    const cases = [
      undefined,
      { _id: oid(), role: 'student', isActive: true },
      { _id: oid(), role: 'admin', isActive: true },
      { _id: oid(), role: 'technician', isActive: false },
    ];
    for (const technician of cases) {
      expect(
        outcome(() =>
          assertTransition({
            issue: issueIn('open'),
            actor: admin,
            to: 'assigned',
            input: { technician },
          }),
        ),
      ).toBe(400);
    }
  });

  it('an unknown target is 400', () => {
    expect(
      outcome(() => assertTransition({ issue: issueIn('open'), actor: admin, to: 'deleted' })),
    ).toBe(400);
  });

  it('a technician who is not the assignee cannot start the job (403)', () => {
    expect(
      outcome(() =>
        assertTransition({
          issue: issueIn('assigned'),
          actor: actorOf('otherTechnician'),
          to: 'in_progress',
        }),
      ),
    ).toBe(403);
  });
});
