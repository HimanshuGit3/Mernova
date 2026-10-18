import { describe, it, expect, afterEach } from 'vitest';
import { User } from '../models/User.js';
import { createFcmSender, initPush } from '../services/fcm.js';
import { pushEnabled, setPushSender } from '../services/push.js';
import { notify } from '../services/notifications.js';
import { makeUser } from './helpers.js';

afterEach(() => setPushSender(null));

/** A fake firebase-admin Messaging: tokens starting with "dead" are rejected as unregistered. */
function fakeMessaging() {
  const calls = [];
  return {
    calls,
    async sendEachForMulticast(msg) {
      calls.push(msg);
      const responses = msg.tokens.map((t) =>
        t.startsWith('dead')
          ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
          : { success: true },
      );
      return { successCount: responses.filter((r) => r.success).length, responses };
    },
  };
}

describe('Firebase push (D5)', () => {
  it('is disabled without FIREBASE_SERVICE_ACCOUNT and notifications still save', async () => {
    expect(await initPush()).toBe('disabled');
    expect(pushEnabled()).toBe(false);
    const { user } = await makeUser();
    const saved = await notify([user._id], { type: 'status_changed', title: 'Hi' });
    expect(saved).toHaveLength(1);
  });

  it('sends to every device of the users and removes dead tokens', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await User.updateOne({ _id: a.user._id }, { fcmTokens: ['phone-a-1', 'dead-a-2'] });
    await User.updateOne({ _id: b.user._id }, { fcmTokens: ['phone-b-1'] });
    const messaging = fakeMessaging();
    const send = createFcmSender(messaging);

    const res = await send([a.user._id, b.user._id], {
      title: 'New job',
      body: 'B-204',
      data: { issueId: 42, type: 'issue_assigned' },
    });
    expect(res).toEqual({ sent: 2, removed: 1 });
    const msg = messaging.calls[0];
    expect(msg.tokens.sort()).toEqual(['dead-a-2', 'phone-a-1', 'phone-b-1']);
    expect(msg.notification).toEqual({ title: 'New job', body: 'B-204' });
    expect(msg.data).toEqual({ issueId: '42', type: 'issue_assigned' }); // FCM data values must be strings
    expect(msg.android.notification.channelId).toBe('fixit_updates');
    const after = await User.findById(a.user._id).select('+fcmTokens');
    expect(after.fcmTokens).toEqual(['phone-a-1']);
  });

  it('does nothing for users without devices', async () => {
    const c = await makeUser();
    const messaging = fakeMessaging();
    expect(await createFcmSender(messaging)([c.user._id], { title: 'x' })).toEqual({
      sent: 0,
      removed: 0,
    });
    expect(messaging.calls).toHaveLength(0);
  });

  it('notify() hands every notification to the push sender, and push failures never break it', async () => {
    const d = await makeUser();
    const pushed = [];
    setPushSender(async (ids, payload) => {
      pushed.push({ ids: ids.map(String), payload });
      throw new Error('FCM is down');
    });
    const saved = await notify([d.user._id], {
      type: 'issue_assigned',
      title: 'Job',
      body: 'Fix it',
      issue: null,
    });
    expect(saved).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      ids: [d.id],
      payload: { title: 'Job', body: 'Fix it', data: { type: 'issue_assigned' } },
    });
  });
});
