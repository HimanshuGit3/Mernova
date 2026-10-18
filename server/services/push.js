/**
 * Optional Firebase Cloud Messaging (D5). Everything works without it: notifications are
 * still saved and delivered over Socket.IO while the app is open.
 * Real implementation added in phase 10; until configured, every call is a no-op.
 */

let sender = null;

export function setPushSender(fn) {
  sender = fn;
}

export function pushEnabled() {
  return Boolean(sender);
}

/** Send a notification to every registered device of the given users. Never throws. */
export async function pushToUsers(userIds, payload) {
  if (!sender || userIds.length === 0) return;
  try {
    await sender(userIds, payload);
  } catch (err) {
    console.warn('[push] failed:', err.message);
  }
}
