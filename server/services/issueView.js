import { isOverdue } from './sla.js';
import { allowedTransitions } from '../utils/transitions.js';

/**
 * Turn issue documents into API objects. Visibility of personal data lives here:
 * the reporter's identity is shown only to admins and to the reporter.
 */

export const POPULATE = [
  { path: 'locationRef', select: 'code building floor room label point isActive' },
  { path: 'assignedTo', select: 'name role' },
  { path: 'reportedBy', select: 'name role' },
];
export const POPULATE_DETAIL = [
  ...POPULATE,
  { path: 'statusHistory.changedBy', select: 'name role' },
];

export const idOf = (v) =>
  v && typeof v === 'object' && '_id' in v ? String(v._id) : v ? String(v) : null;

function locationOf(loc) {
  if (!loc || typeof loc !== 'object' || !('code' in loc)) return null;
  return {
    id: String(loc._id),
    code: loc.code,
    building: loc.building,
    floor: loc.floor,
    room: loc.room,
    label: loc.label,
  };
}

function pointOf(point) {
  const c = point?.coordinates;
  return c?.length === 2 ? { lat: c[1], lng: c[0] } : null;
}

function personOf(p) {
  if (!p || typeof p !== 'object' || !('name' in p)) return null;
  return { id: String(p._id), name: p.name };
}

/** @param viewer user document, or 'admin' for admin-room broadcasts, or null for public views */
export function toSummary(issue, viewer = null, now = new Date()) {
  const viewerId = viewer && viewer !== 'admin' ? String(viewer._id) : null;
  const isAdmin = viewer === 'admin' || viewer?.role === 'admin';
  const isReporter = viewerId && idOf(issue.reportedBy) === viewerId;
  const supporters = (issue.supporters ?? []).map(idOf);
  const out = {
    id: String(issue._id),
    title: issue.title,
    description: issue.description,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    photoPath: issue.photoPath,
    thumbPath: issue.thumbPath,
    resolutionPhotoPath: issue.resolutionPhotoPath,
    resolutionThumbPath: issue.resolutionThumbPath,
    resolutionNote: issue.resolutionNote,
    location: pointOf(issue.point),
    locationRef: locationOf(issue.locationRef),
    landmark: issue.landmark,
    assignedTo: personOf(issue.assignedTo),
    supportersCount: supporters.length,
    supportedByMe: viewerId ? supporters.includes(viewerId) : false,
    priorityScore: issue.priorityScore,
    dueAt: issue.dueAt,
    overdue: isOverdue(issue, now),
    escalatedAt: issue.escalatedAt,
    ai: issue.ai?.suggestedCategory
      ? {
          suggestedCategory: issue.ai.suggestedCategory,
          confidence: issue.ai.confidence,
          accepted: issue.ai.accepted,
        }
      : null,
    duplicateOf: issue.duplicateOf ? idOf(issue.duplicateOf) : null,
    rejectionReason: issue.rejectionReason,
    assignedAt: issue.assignedAt,
    startedAt: issue.startedAt,
    resolvedAt: issue.resolvedAt,
    closedAt: issue.closedAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
  if (isAdmin || isReporter) out.reporter = personOf(issue.reportedBy);
  out.reportedByMe = Boolean(isReporter);
  return out;
}

/** Detail view: summary + history + the actions this viewer can take now. */
export function toDetail(issue, viewer, now = new Date()) {
  const out = toSummary(issue, viewer, now);
  const viewerId = String(viewer._id);
  out.statusHistory = (issue.statusHistory ?? []).map((h) => {
    let changedBy = 'system';
    if (h.changedBy) {
      const p = h.changedBy;
      const id = idOf(p);
      const role = typeof p === 'object' && 'role' in p ? p.role : undefined;
      // Names: admins see everyone; technicians see staff names only (never the reporter's,
      // D-11); students see only their own name. Everyone else is shown by role.
      const showName =
        id === viewerId ||
        viewer.role === 'admin' ||
        (viewer.role === 'technician' && (role === 'admin' || role === 'technician'));
      changedBy = showName ? { id, name: p.name, role } : { role };
    }
    return { status: h.status, changedBy, at: h.at, note: h.note };
  });
  out.allowedActions = allowedTransitions(issue, viewer, now);
  if (viewer.role === 'student' && !out.reportedByMe && !out.supportedByMe) out.allowedActions = [];
  out.canSupport =
    viewer.role === 'student' &&
    !out.reportedByMe &&
    !out.supportedByMe &&
    ['open', 'assigned', 'in_progress', 'reopened'].includes(issue.status);
  return out;
}

/** "Fixed on campus" item: no reporter or assignee identity (FR-59). */
export function toFeedItem(issue) {
  const loc = locationOf(issue.locationRef);
  const created = new Date(issue.createdAt).getTime();
  const resolved = issue.resolvedAt ? new Date(issue.resolvedAt).getTime() : null;
  return {
    id: String(issue._id),
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    building: loc?.building ?? null,
    place: loc
      ? [loc.building, loc.room && `Room ${loc.room}`].filter(Boolean).join(' · ')
      : issue.landmark || null,
    photoPath: issue.photoPath,
    thumbPath: issue.thumbPath,
    resolutionPhotoPath: issue.resolutionPhotoPath,
    resolutionThumbPath: issue.resolutionThumbPath,
    resolutionNote: issue.resolutionNote,
    supportersCount: issue.supporters?.length ?? 0,
    createdAt: issue.createdAt,
    resolvedAt: issue.resolvedAt,
    resolutionHours: resolved ? Math.round(((resolved - created) / 36e5) * 10) / 10 : null,
  };
}
