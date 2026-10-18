import { SLA_STOPPED } from '../utils/constants.js';

const HOUR = 60 * 60 * 1000;

/** SLA per severity in hours (D2). */
export const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };
export const SEVERITY_WEIGHT = { critical: 100, high: 60, medium: 30, low: 10 };
export const SUPPORTER_WEIGHT = 8;
export const OVERDUE_WEIGHT_PER_HOUR = 2;
export const OVERDUE_HOURS_CAP = 48;

export function computeDueAt(from, severity) {
  return new Date(new Date(from).getTime() + SLA_HOURS[severity] * HOUR);
}

export function isOverdue(issue, now = new Date()) {
  if (SLA_STOPPED.includes(issue.status)) return false;
  return now.getTime() > new Date(issue.dueAt).getTime();
}

/** Whole hours past the due date (0 when not overdue). */
export function hoursOverdue(issue, now = new Date()) {
  if (!isOverdue(issue, now)) return 0;
  return Math.floor((now.getTime() - new Date(issue.dueAt).getTime()) / HOUR);
}

/** priorityScore = severityWeight + 8 × supporters + 2 × min(48, hours overdue) (D2). */
export function computePriority(issue, now = new Date()) {
  const supporters = issue.supporters?.length ?? 0;
  return (
    SEVERITY_WEIGHT[issue.severity] +
    SUPPORTER_WEIGHT * supporters +
    OVERDUE_WEIGHT_PER_HOUR * Math.min(OVERDUE_HOURS_CAP, hoursOverdue(issue, now))
  );
}

/**
 * Recompute derived SLA fields on an issue document (call before every save).
 * Returns true when the issue has just become overdue for the first time,
 * so the caller can notify admins exactly once.
 */
export function refreshSla(issue, now = new Date()) {
  issue.priorityScore = computePriority(issue, now);
  if (isOverdue(issue, now) && !issue.escalatedAt) {
    issue.escalatedAt = now;
    return true;
  }
  return false;
}
