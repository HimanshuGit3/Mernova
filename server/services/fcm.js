import fs from 'node:fs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { setPushSender } from './push.js';

/** FCM error codes that mean "this device token is dead; forget it". */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Build the push sender around a Firebase Messaging instance (injected so tests can fake it).
 * Sends to every registered device of the users and removes tokens FCM reports as dead.
 */
export function createFcmSender(messaging) {
  return async function send(userIds, { title, body, data }) {
    const users = await User.find({ _id: { $in: userIds }, isActive: true })
      .select('+fcmTokens')
      .lean();
    const tokens = [...new Set(users.flatMap((u) => u.fcmTokens ?? []))];
    if (tokens.length === 0) return { sent: 0, removed: 0 };
    let sent = 0;
    const dead = [];
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500); // FCM multicast limit
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])),
        android: {
          priority: 'high',
          notification: { channelId: 'fixit_updates', color: '#0F1F3D' },
        },
      });
      sent += res.successCount;
      res.responses.forEach((r, j) => {
        if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(batch[j]);
      });
    }
    if (dead.length)
      await User.updateMany({ fcmTokens: { $in: dead } }, { $pull: { fcmTokens: { $in: dead } } });
    return { sent, removed: dead.length };
  };
}

/**
 * Enable FCM when FIREBASE_SERVICE_ACCOUNT points to a service-account JSON (D5).
 * Without it, push stays a no-op and notifications still arrive in-app over Socket.IO.
 * @returns {Promise<'enabled'|'disabled'|'failed'>}
 */
export async function initPush() {
  const file = env.FIREBASE_SERVICE_ACCOUNT;
  if (!file) return 'disabled';
  try {
    const account = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const app = getApps()[0] ?? initializeApp({ credential: cert(account) });
    setPushSender(createFcmSender(getMessaging(app)));
    console.log(`[push] Firebase Cloud Messaging enabled for project ${account.project_id}`);
    return 'enabled';
  } catch (err) {
    console.warn(`[push] Firebase not enabled (${err.message}). Notifications stay in-app only.`);
    return 'failed';
  }
}
