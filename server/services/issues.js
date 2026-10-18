import { Issue } from '../models/Issue.js';
import { Location } from '../models/Location.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVE_STATUSES } from '../utils/constants.js';
import { escapeRegex } from '../utils/text.js';
import { assertTransition } from '../utils/transitions.js';
import { computeDueAt, isOverdue, refreshSla } from './sla.js';
import { saveImage } from './storage.js';
import { embedImage } from './ai.js';
import { notify, notifyAdmins } from './notifications.js';
import { emitIssueCreated, emitIssueUpdated, statsChanged } from './realtime.js';
import { POPULATE, POPULATE_DETAIL, idOf, toDetail, toFeedItem, toSummary } from './issueView.js';

const CATEGORY_LABEL = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  furniture: 'Furniture',
  network: 'Network',
  cleanliness: 'Cleanliness',
  safety: 'Safety',
  other: 'Other',
};

/** Which issues a user may see (SPEC 5 "Visibility"). */
export function scopeFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'technician') return { assignedTo: user._id };
  return { $or: [{ reportedBy: user._id }, { supporters: user._id }] };
}

async function findVisible(id, user, populate = POPULATE) {
  const issue = await Issue.findOne({ _id: id, ...scopeFilter(user) }).populate(populate);
  if (!issue) throw ApiError.notFound('Issue not found');
  return issue;
}

function placeOf(issue) {
  const loc = issue.locationRef;
  if (loc && typeof loc === 'object' && 'code' in loc) return `${loc.code}, ${loc.building}`;
  return issue.landmark || 'campus';
}

/** Emit `issue:updated` with the right view per audience, then `stats:changed`. */
async function publishUpdate(issue, changes) {
  await issue.populate(POPULATE);
  const reporterId = idOf(issue.reportedBy);
  emitIssueUpdated({
    adminView: toSummary(issue, 'admin'),
    publicView: toSummary(issue, null),
    reporterView: toSummary(issue, { _id: reporterId, role: 'student' }),
    reporterId,
    userIds: [...issue.supporters.map(idOf), idOf(issue.assignedTo)].filter(Boolean),
    changes,
  });
  statsChanged();
}

// ---------------------------------------------------------------- create

export async function createIssue(user, input, file) {
  if (input.clientRequestId) {
    const existing = await Issue.findOne({ clientRequestId: input.clientRequestId }).populate(
      POPULATE_DETAIL,
    );
    if (existing) return replay(existing, user);
  }

  let location = null;
  if (input.locationId) {
    location = await Location.findOne({ _id: input.locationId, isActive: true });
    if (!location)
      throw ApiError.badRequest('Unknown or inactive location', [
        { path: 'locationId', message: 'Unknown or inactive location' },
      ]);
  }
  const hasGps = input.lat !== undefined && input.lng !== undefined;
  if (!location && !hasGps && !input.landmark) {
    throw ApiError.badRequest('Add a landmark when there is no GPS or room QR', [
      { path: 'landmark', message: 'Required without GPS or a room' },
    ]);
  }
  // A scanned room is more precise indoors than GPS (D9), so it wins.
  const point = location
    ? location.point
    : hasGps
      ? { type: 'Point', coordinates: [input.lng, input.lat] }
      : undefined;

  let photo = null;
  let embedding = null;
  if (file) {
    photo = await saveImage(file.buffer);
    embedding = await embedImage(photo.buffer);
  }

  const now = new Date();
  const issue = new Issue({
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    photoPath: photo?.photoPath ?? null,
    thumbPath: photo?.thumbPath ?? null,
    point,
    locationRef: location?._id ?? null,
    landmark: input.landmark ?? '',
    status: 'open',
    reportedBy: user._id,
    createdAt: now, // same instant as the SLA start, so dueAt − createdAt is exactly the SLA
    slaStartedAt: now,
    dueAt: computeDueAt(now, input.severity),
    ai: input.aiSuggestedCategory
      ? {
          suggestedCategory: input.aiSuggestedCategory,
          confidence: input.aiConfidence ?? null,
          accepted: input.aiSuggestedCategory === input.category,
        }
      : undefined,
    embedding: embedding ?? undefined,
    clientRequestId: input.clientRequestId,
    statusHistory: [{ status: 'open', changedBy: user._id, at: now, note: 'Reported' }],
  });
  refreshSla(issue, now);
  try {
    await issue.save();
  } catch (err) {
    // Two retries raced: the unique index decided, return the winner (idempotent).
    if (err?.code === 11000 && input.clientRequestId) {
      const winner = await Issue.findOne({ clientRequestId: input.clientRequestId }).populate(
        POPULATE_DETAIL,
      );
      if (winner) return replay(winner, user);
    }
    throw err;
  }

  await issue.populate(POPULATE_DETAIL);
  emitIssueCreated(toSummary(issue, 'admin'));
  statsChanged();
  await notifyAdmins({
    type: 'issue_created',
    title: `New ${CATEGORY_LABEL[issue.category].toLowerCase()} issue`,
    body: `${issue.title} · ${placeOf(issue)}`,
    issue,
  });
  return { issue: toDetail(issue, user), created: true };
}

function replay(existing, user) {
  if (idOf(existing.reportedBy) !== String(user._id)) {
    throw ApiError.conflict('This request id was already used', 'DUPLICATE');
  }
  return { issue: toDetail(existing, user), created: false };
}

// ---------------------------------------------------------------- read

function sortOf(sort) {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1, _id: 1 };
    case 'priority':
      return { priorityScore: -1, dueAt: 1, _id: 1 };
    case 'due':
      return { dueAt: 1, _id: 1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}

export async function buildListFilter(user, q) {
  const and = [scopeFilter(user)];
  if (q.status) and.push({ status: { $in: q.status } });
  if (q.category) and.push({ category: { $in: q.category } });
  if (q.severity) and.push({ severity: { $in: q.severity } });
  if (q.building) {
    const locs = await Location.find({ building: q.building }).select('_id').lean();
    and.push({ locationRef: { $in: locs.map((l) => l._id) } });
  }
  if (q.from || q.to) {
    const range = {};
    if (q.from) range.$gte = q.from;
    if (q.to) range.$lte = q.to;
    and.push({ createdAt: range });
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { landmark: rx }] });
  }
  if (q.overdue) and.push({ status: { $in: ACTIVE_STATUSES }, dueAt: { $lt: new Date() } });
  if (q.assignedTo && user.role === 'admin') and.push({ assignedTo: q.assignedTo });
  if (q.mine) and.push({ reportedBy: user._id });
  return { $and: and };
}

export async function listIssues(user, q) {
  const filter = await buildListFilter(user, q);
  const [docs, total] = await Promise.all([
    Issue.find(filter)
      .sort(sortOf(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(POPULATE),
    Issue.countDocuments(filter),
  ]);
  const now = new Date();
  return { items: docs.map((d) => toSummary(d, user, now)), total };
}

export async function getIssue(user, id) {
  const issue = await findVisible(id, user, POPULATE_DETAIL);
  return toDetail(issue, user);
}

export async function feed({ page, limit }) {
  const filter = { status: { $in: ['resolved', 'closed'] }, resolutionPhotoPath: { $ne: null } };
  const [docs, total] = await Promise.all([
    Issue.find(filter)
      .sort({ resolvedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'locationRef', select: 'code building floor room label' }),
    Issue.countDocuments(filter),
  ]);
  return { items: docs.map(toFeedItem), total };
}

// ---------------------------------------------------------------- admin edit

export async function patchIssue(admin, id, patch) {
  const issue = await findVisible(id, admin);
  const changes = [];
  for (const key of ['title', 'category', 'severity']) {
    if (patch[key] !== undefined && patch[key] !== issue[key]) {
      issue[key] = patch[key];
      changes.push(key);
    }
  }
  if (changes.includes('severity')) {
    issue.dueAt = computeDueAt(issue.slaStartedAt, issue.severity);
    if (!isOverdue(issue)) issue.escalatedAt = null;
    changes.push('dueAt');
  }
  if (changes.length === 0) return getIssue(admin, id);
  const escalated = refreshSla(issue);
  await issue.save();
  if (escalated) await escalate(issue);
  await publishUpdate(issue, changes);
  return getIssue(admin, id);
}

// ---------------------------------------------------------------- me too

export async function supportIssue(student, id) {
  const issue = await Issue.findById(id).populate(POPULATE);
  if (!issue) throw ApiError.notFound('Issue not found');
  if (!ACTIVE_STATUSES.includes(issue.status)) {
    throw ApiError.conflict('This issue is no longer open for support', 'INVALID_TRANSITION');
  }
  if (idOf(issue.reportedBy) === String(student._id)) {
    throw ApiError.conflict('You reported this issue');
  }
  const already = issue.supporters.some((s) => idOf(s) === String(student._id));
  if (!already) {
    issue.supporters.push(student._id);
    refreshSla(issue);
    await issue.save();
    await notify([idOf(issue.reportedBy)], {
      type: 'me_too',
      title: 'Someone else has this problem too',
      body: `${issue.supporters.length} ${issue.supporters.length === 1 ? 'person supports' : 'people support'} "${issue.title}"`,
      issue,
    });
    await publishUpdate(issue, ['supporters', 'priorityScore']);
  }
  return getIssue(student, id);
}

// ---------------------------------------------------------------- assignment

export async function assignIssue(admin, id, { technicianId, note }) {
  const issue = await findVisible(id, admin);
  const technician = await User.findById(technicianId);
  assertTransition({ issue, actor: admin, to: 'assigned', input: { technician } });
  const previous = issue.assignedTo;
  if (issue.status === 'assigned' && idOf(previous) === String(technician._id)) {
    throw ApiError.conflict(`Already assigned to ${technician.name}`, 'INVALID_TRANSITION');
  }
  const now = new Date();
  const reassign = Boolean(previous) && ['assigned', 'in_progress'].includes(issue.status);
  issue.assignedTo = technician._id;
  issue.status = 'assigned';
  issue.assignedAt = now;
  issue.startedAt = null;
  issue.statusHistory.push({
    status: 'assigned',
    changedBy: admin._id,
    at: now,
    note:
      note ||
      (reassign
        ? `Reassigned from ${previous.name ?? 'technician'} to ${technician.name}`
        : `Assigned to ${technician.name}`),
  });
  const escalated = refreshSla(issue, now);
  await issue.save();
  if (escalated) await escalate(issue);

  await notify([technician._id], {
    type: 'issue_assigned',
    title: 'New job assigned to you',
    body: `${issue.title} · ${placeOf(issue)} · ${issue.severity} priority`,
    issue,
  });
  if (reassign && idOf(previous) !== String(technician._id)) {
    await notify([idOf(previous)], {
      type: 'status_changed',
      title: 'Job reassigned',
      body: `"${issue.title}" was reassigned to another technician`,
      issue,
    });
  }
  if (!reassign) {
    await notify([idOf(issue.reportedBy)], {
      type: 'status_changed',
      title: 'Your report has been assigned',
      body: `A technician is on "${issue.title}"`,
      issue,
      except: admin._id,
    });
  }
  await publishUpdate(issue, ['status', 'assignedTo']);
  return getIssue(admin, id);
}

// ---------------------------------------------------------------- transitions

/**
 * Apply a non-assignment transition. Used by HTTP (actor = user) and jobs (actor = 'system').
 * Assumes the caller already checked visibility.
 */
export async function applyTransition(
  issue,
  actor,
  to,
  { note = '', reason = '', duplicateOf = null, file = null } = {},
) {
  const now = new Date();
  assertTransition({ issue, actor, to, input: { photo: file, reason }, now });
  const actorId = actor === 'system' ? null : actor._id;
  if (to === 'rejected' && duplicateOf) {
    if (String(duplicateOf) === String(issue._id))
      throw ApiError.badRequest('An issue cannot duplicate itself');
    if (!(await Issue.exists({ _id: duplicateOf })))
      throw ApiError.badRequest('duplicateOf issue not found', [
        { path: 'duplicateOf', message: 'Not found' },
      ]);
  }

  switch (to) {
    case 'in_progress':
      issue.startedAt = now;
      break;
    case 'resolved': {
      const saved = await saveImage(file.buffer);
      issue.resolutionPhotoPath = saved.photoPath;
      issue.resolutionThumbPath = saved.thumbPath;
      issue.resolutionNote = note;
      issue.resolvedAt = now;
      break;
    }
    case 'closed':
      issue.closedAt = now;
      break;
    case 'reopened':
      // The fix did not hold: restart the SLA clock (DECISIONS D-07).
      issue.resolvedAt = null;
      issue.startedAt = null;
      issue.slaStartedAt = now;
      issue.dueAt = computeDueAt(now, issue.severity);
      issue.escalatedAt = null;
      break;
    case 'rejected':
      issue.rejectionReason = reason;
      issue.duplicateOf = duplicateOf || null;
      break;
    default:
      break;
  }
  issue.status = to;
  issue.statusHistory.push({
    status: to,
    changedBy: actorId,
    at: now,
    note:
      (to === 'reopened' || to === 'rejected' ? reason : note) ||
      (actor === 'system' ? 'Closed automatically' : ''),
  });
  const escalated = refreshSla(issue, now);
  await issue.save();
  if (escalated) await escalate(issue);
  await notifyForTransition(issue, to, actorId);
  await publishUpdate(issue, ['status']);
  return issue;
}

async function notifyForTransition(issue, to, actorId) {
  const reporter = idOf(issue.reportedBy);
  const followers = [reporter, ...issue.supporters.map(idOf)];
  const assignee = idOf(issue.assignedTo);
  const base = { issue, except: actorId };
  switch (to) {
    case 'in_progress':
      return notify(followers, {
        ...base,
        type: 'status_changed',
        title: 'Work has started',
        body: `A technician started on "${issue.title}"`,
      });
    case 'resolved':
      await notify(followers, {
        ...base,
        type: 'status_changed',
        title: 'Fixed! Please confirm',
        body: `"${issue.title}" was marked resolved. Confirm the fix or reopen it.`,
      });
      return notifyAdmins({
        ...base,
        type: 'status_changed',
        title: 'Issue resolved',
        body: `${issue.title} · ${placeOf(issue)}`,
      });
    case 'closed':
      return notify([assignee, reporter], {
        ...base,
        type: 'status_changed',
        title: 'Fix confirmed',
        body: `"${issue.title}" is closed`,
      });
    case 'reopened':
      await notify([assignee], {
        ...base,
        type: 'status_changed',
        title: 'Issue reopened',
        body: `"${issue.title}": ${issue.statusHistory.at(-1).note}`,
      });
      return notifyAdmins({
        ...base,
        type: 'status_changed',
        title: 'Issue reopened by reporter',
        body: `${issue.title} · ${placeOf(issue)}`,
      });
    case 'rejected':
      return notify(followers, {
        ...base,
        type: 'status_changed',
        title: 'Report closed without action',
        body: `"${issue.title}": ${issue.rejectionReason}`,
      });
    default:
      return null;
  }
}

export async function transitionIssue(user, id, { to, note, reason, duplicateOf }, file) {
  const issue = await findVisible(id, user);
  await applyTransition(issue, user, to, { note, reason, duplicateOf, file });
  return getIssue(user, id);
}

// ---------------------------------------------------------------- SLA escalation

/** First time an issue becomes overdue: notify admins once (D2). */
export async function escalate(issue) {
  await notifyAdmins({
    type: 'sla_overdue',
    title: 'SLA breached',
    body: `${issue.title} · ${issue.severity} · ${placeOf(issue)}`,
    issue,
  });
}
