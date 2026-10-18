import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitNotification } from './realtime.js';
import { pushToUsers } from './push.js';

/**
 * Save an inbox entry for each user, emit it over Socket.IO, and push it via FCM
 * when Firebase is configured (D5). Never notifies the actor about their own action.
 * @param {Array} userIds
 * @param {{ type, title, body?, issue?, except? }} message
 */
export async function notify(userIds, { type, title, body = '', issue = null, except = null }) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))].filter(
    (id) => !except || id !== String(except),
  );
  if (unique.length === 0) return [];
  const issueId = issue?._id ?? issue ?? null;
  const docs = await Notification.insertMany(
    unique.map((user) => ({ user, type, title, body, issue: issueId })),
  );
  const saved = docs.map((d) => d.toJSON());
  saved.forEach(emitNotification);
  await pushToUsers(unique, {
    title,
    body,
    data: { type, issueId: issueId ? String(issueId) : '' },
  });
  return saved;
}

export async function activeAdminIds() {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  return admins.map((a) => a._id);
}

export async function notifyAdmins(message) {
  return notify(await activeAdminIds(), message);
}

export async function listForUser(userId, { page, limit, unread }) {
  const filter = { user: userId };
  if (unread) filter.readAt = null;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { items, total, unreadCount };
}

export async function markRead(userId, id) {
  const n = await Notification.findOne({ _id: id, user: userId });
  if (n && !n.readAt) {
    n.readAt = new Date();
    await n.save();
  }
  return n;
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany({ user: userId, readAt: null }, { readAt: new Date() });
  return res.modifiedCount;
}
