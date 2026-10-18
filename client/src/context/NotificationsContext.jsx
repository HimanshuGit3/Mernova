import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { notificationsApi } from '../api/index.js';
import { NotificationsContext, useAuth } from './auth.js';
import { useReconnect, useSocketEvent } from '../realtime/hooks.js';

const EMPTY = [];

/** The shared notification inbox (FR-50): REST for history, Socket.IO for new items. */
export function NotificationsProvider({ children }) {
  const { status, user } = useAuth();
  // Items are kept per user, so signing out (or switching accounts) never shows stale data.
  const [state, setState] = useState({ userId: null, items: EMPTY, unread: 0, error: null });
  const userId = status === 'signed-in' ? user?.id : null;
  const mine = state.userId === userId && userId !== null;

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve();
    return notificationsApi.list({ limit: 15 }).then(
      (res) => setState({ userId, items: res.items, unread: res.unreadCount, error: null }),
      () => setState((s) => ({ ...s, userId, error: 'Could not load notifications' })),
    );
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useReconnect(refresh);
  useSocketEvent('notification:new', (n) => {
    setState((s) => ({
      ...s,
      items: [n, ...s.items.filter((p) => p.id !== n.id)].slice(0, 30),
      unread: s.unread + 1,
    }));
    toast(n.title, { description: n.body });
  });

  const markRead = useCallback(async (id) => {
    setState((s) => ({
      ...s,
      items: s.items.map((n) =>
        n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unread: Math.max(0, s.unread - 1),
    }));
    try {
      await notificationsApi.read(id);
    } catch {
      /* the next refresh fixes the count */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setState((s) => ({
      ...s,
      items: s.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      unread: 0,
    }));
    await notificationsApi.readAll();
  }, []);

  const value = useMemo(
    () => ({
      items: mine ? state.items : EMPTY,
      unread: mine ? state.unread : 0,
      loading: Boolean(userId) && !mine,
      error: mine ? state.error : null,
      refresh,
      markRead,
      markAllRead,
    }),
    [mine, state, userId, refresh, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
