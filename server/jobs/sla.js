import { Issue } from '../models/Issue.js';
import { ACTIVE_STATUSES } from '../utils/constants.js';
import { computePriority, isOverdue } from '../services/sla.js';
import { escalate } from '../services/issues.js';
import { emitIssueUpdated, statsChanged } from '../services/realtime.js';
import { POPULATE, toSummary } from '../services/issueView.js';

/**
 * Hourly SLA sweep (D2): recompute the priority of every active issue (overdue hours change
 * over time) and escalate issues that have just become overdue — notify admins once and set
 * `escalatedAt`. Returns what changed, for logs and tests.
 */
export async function runSlaSweep(now = new Date()) {
  const cursor = Issue.find({ status: { $in: ACTIVE_STATUSES } })
    .select('status severity supporters dueAt priorityScore escalatedAt')
    .cursor();
  const ops = [];
  const newlyOverdue = [];
  for await (const issue of cursor) {
    const priorityScore = computePriority(issue, now);
    const set = {};
    if (priorityScore !== issue.priorityScore) set.priorityScore = priorityScore;
    if (!issue.escalatedAt && isOverdue(issue, now)) {
      set.escalatedAt = now;
      newlyOverdue.push(issue._id);
    }
    if (Object.keys(set).length)
      ops.push({ updateOne: { filter: { _id: issue._id }, update: { $set: set } } });
  }
  if (ops.length) await Issue.bulkWrite(ops, { ordered: false });

  // Notify only after the write, and only for issues this sweep escalated (never twice).
  for (const id of newlyOverdue) {
    const issue = await Issue.findById(id).populate(POPULATE);
    await escalate(issue);
    emitIssueUpdated({
      adminView: toSummary(issue, 'admin', now),
      publicView: toSummary(issue, null, now),
      reporterView: toSummary(issue, { _id: issue.reportedBy._id, role: 'student' }, now),
      reporterId: String(issue.reportedBy._id),
      userIds: [...issue.supporters.map(String), issue.assignedTo?._id].filter(Boolean),
      changes: ['overdue', 'priorityScore'],
    });
  }
  if (ops.length) statsChanged();
  return { updated: ops.length, escalated: newlyOverdue.length };
}
