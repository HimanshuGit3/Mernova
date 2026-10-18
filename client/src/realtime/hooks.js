import { createContext, useContext, useEffect, useRef } from 'react';

export const SocketContext = createContext({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

/** Keep the latest callback in a ref so subscriptions never need to be redone for it. */
function useLatest(fn) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return ref;
}

/** Subscribe to a server event for the lifetime of the component. The handler can change freely. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useLatest(handler);
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event, ref]);
}

/** Run `fn` after every reconnect (not the first connect): refetch what is on screen. */
export function useReconnect(fn) {
  const { socket } = useSocket();
  const ref = useLatest(fn);
  useEffect(() => {
    if (!socket) return undefined;
    const handler = () => ref.current();
    socket.io.on('reconnect', handler);
    return () => socket.io.off('reconnect', handler);
  }, [socket, ref]);
}

/**
 * Refetch when any of the given events arrives (debounced), and after reconnecting.
 * `filter(event, payload)` can ignore irrelevant events.
 */
export function useLiveRefetch(events, refetch, { delay = 250, filter } = {}) {
  const { socket } = useSocket();
  const refetchRef = useLatest(refetch);
  const filterRef = useLatest(filter);
  const eventKey = events.join('|');
  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const names = eventKey.split('|');
    const handlers = names.map((event) => {
      const fn = (payload) => {
        if (filterRef.current && !filterRef.current(event, payload)) return;
        clearTimeout(timer);
        timer = setTimeout(() => refetchRef.current(), delay);
      };
      socket.on(event, fn);
      return [event, fn];
    });
    const onReconnect = () => refetchRef.current();
    socket.io.on('reconnect', onReconnect);
    return () => {
      handlers.forEach(([event, fn]) => socket.off(event, fn));
      socket.io.off('reconnect', onReconnect);
      clearTimeout(timer);
    };
  }, [socket, eventKey, delay, refetchRef, filterRef]);
}
