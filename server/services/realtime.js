/**
 * Realtime events (SPEC section 10). Services call these emitters; they are no-ops
 * until `attachIo` is called by the Socket.IO server (server/services/socket.js).
 */

let io = null;
const STATS_THROTTLE_MS = 2000;
let statsTimer = null;
let statsPendingSince = null;

export function attachIo(server) {
  io = server;
}

export function detachIo() {
  io = null;
  if (statsTimer) clearTimeout(statsTimer);
  statsTimer = null;
  statsPendingSince = null;
}

export const rooms = {
  user: (id) => `user:${String(id)}`,
  admins: 'role:admin',
};

/** `issue:created` → admins only. */
export function emitIssueCreated(adminView) {
  io?.to(rooms.admins).emit('issue:created', adminView);
}

/**
 * `issue:updated` → admins, reporter, supporters, assignee.
 * Admins get the full view; everyone else a view without the reporter's identity.
 */
export function emitIssueUpdated({
  adminView,
  publicView,
  reporterView,
  reporterId,
  userIds,
  changes,
}) {
  if (!io) return;
  io.to(rooms.admins).emit('issue:updated', { issue: adminView, changes });
  if (reporterId) {
    io.to(rooms.user(reporterId))
      .except(rooms.admins)
      .emit('issue:updated', { issue: reporterView, changes });
  }
  const others = [...new Set(userIds.map(String))].filter((id) => id !== String(reporterId));
  if (others.length) {
    io.to(others.map(rooms.user))
      .except([rooms.admins, ...(reporterId ? [rooms.user(reporterId)] : [])])
      .emit('issue:updated', { issue: publicView, changes });
  }
}

/** `notification:new` → the owner of the notification. */
export function emitNotification(notification) {
  io?.to(rooms.user(notification.user)).emit('notification:new', notification);
}

/** `stats:changed` → admins, throttled to at most one emit per 2 s (trailing). */
export function statsChanged() {
  if (!io) return;
  if (statsTimer) return; // one is already scheduled; it will cover this change
  const now = Date.now();
  const wait =
    statsPendingSince && now - statsPendingSince < STATS_THROTTLE_MS
      ? STATS_THROTTLE_MS - (now - statsPendingSince)
      : 0;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    statsPendingSince = Date.now();
    io?.to(rooms.admins).emit('stats:changed');
  }, wait);
}
