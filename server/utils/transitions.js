import { ApiError } from './ApiError.js';

export const REOPEN_WINDOW_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/**
 * The only place that decides which status changes are allowed (SPEC D1).
 * `who` names relationships between the actor and the issue:
 *   admin    – any active admin
 *   assignee – the technician the issue is assigned to
 *   reporter – the user who reported the issue
 *   system   – background jobs (auto-close)
 */
export const TRANSITIONS = Object.freeze({
  assigned: {
    from: ['open', 'reopened', 'assigned', 'in_progress'],
    who: ['admin'],
    needs: ['technician'],
  },
  in_progress: { from: ['assigned'], who: ['assignee'] },
  resolved: { from: ['in_progress'], who: ['assignee'], needs: ['photo'] },
  closed: { from: ['resolved'], who: ['reporter', 'admin', 'system'] },
  reopened: {
    from: ['resolved'],
    who: ['reporter'],
    needs: ['reason'],
    withinDaysOfResolution: REOPEN_WINDOW_DAYS,
  },
  rejected: { from: ['open', 'reopened'], who: ['admin'], needs: ['reason'] },
});

export const TERMINAL = ['closed', 'rejected'];

const idOf = (v) =>
  v && typeof v === 'object' && '_id' in v ? String(v._id) : v ? String(v) : null;

/** The relationships an actor has with an issue. `actor` is a user document or the string 'system'. */
export function relationsOf(issue, actor) {
  if (actor === 'system') return new Set(['system']);
  const rel = new Set();
  const id = String(actor._id);
  if (actor.role === 'admin') rel.add('admin');
  if (actor.role === 'technician' && idOf(issue.assignedTo) === id) rel.add('assignee');
  if (idOf(issue.reportedBy) === id) rel.add('reporter');
  return rel;
}

/**
 * Throw an ApiError unless `actor` may move `issue` to `to`.
 * Order: unknown target (400) → not allowed from this status (409) → not your role (403)
 * → missing input (400) → time window (409).
 * @param {{ issue, actor, to, input?: { photo?, reason?, technician? }, now?: Date }} args
 */
export function assertTransition({ issue, actor, to, input = {}, now = new Date() }) {
  const rule = TRANSITIONS[to];
  if (!rule) throw ApiError.badRequest(`Unknown status "${to}"`);
  if (!rule.from.includes(issue.status)) {
    throw ApiError.conflict(
      `Cannot change status from ${issue.status} to ${to}`,
      'INVALID_TRANSITION',
    );
  }
  const rel = relationsOf(issue, actor);
  if (!rule.who.some((w) => rel.has(w))) {
    throw ApiError.forbidden(`You cannot change this issue to ${to}`);
  }
  for (const need of rule.needs ?? []) {
    if (need === 'photo' && !input.photo) {
      throw ApiError.badRequest('An after photo is required to resolve', [
        { path: 'photo', message: 'Required' },
      ]);
    }
    if (need === 'reason' && !input.reason?.trim()) {
      throw ApiError.badRequest('A reason is required', [{ path: 'reason', message: 'Required' }]);
    }
    if (need === 'technician') {
      const t = input.technician;
      if (!t || t.role !== 'technician' || !t.isActive) {
        throw ApiError.badRequest('Pick an active technician', [
          { path: 'technicianId', message: 'Must be an active technician' },
        ]);
      }
    }
  }
  if (rule.withinDaysOfResolution) {
    const resolvedAt = issue.resolvedAt ? new Date(issue.resolvedAt).getTime() : 0;
    if (now.getTime() - resolvedAt > rule.withinDaysOfResolution * DAY) {
      throw ApiError.conflict(
        `Issues can only be reopened within ${rule.withinDaysOfResolution} days of being resolved`,
        'REOPEN_WINDOW_CLOSED',
      );
    }
  }
}

/** Target statuses this actor could move the issue to now (ignores inputs like photo/reason). */
export function allowedTransitions(issue, actor, now = new Date()) {
  const rel = relationsOf(issue, actor);
  return Object.entries(TRANSITIONS)
    .filter(([, rule]) => rule.from.includes(issue.status) && rule.who.some((w) => rel.has(w)))
    .filter(([, rule]) => {
      if (!rule.withinDaysOfResolution) return true;
      const resolvedAt = issue.resolvedAt ? new Date(issue.resolvedAt).getTime() : 0;
      return now.getTime() - resolvedAt <= rule.withinDaysOfResolution * DAY;
    })
    .map(([to]) => to);
}
