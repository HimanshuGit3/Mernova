import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';
import { useAuth } from '../context/auth.js';
import { SocketContext } from './hooks.js';

/**
 * One Socket.IO connection per signed-in session (D4). The client object is created (not
 * connected) when the token changes; the effect connects it and closes it on sign-out.
 * It reconnects automatically; views subscribe with the hooks in ./hooks.js.
 */
export function SocketProvider({ children }) {
  const { token, status } = useAuth();
  const socket = useMemo(
    () =>
      status === 'signed-in' && token
        ? io(SOCKET_URL, {
            auth: { token },
            autoConnect: false,
            transports: ['websocket', 'polling'],
            reconnectionDelay: 1000,
            reconnectionDelayMax: 8000,
          })
        : null,
    [token, status],
  );
  const [connectedSocket, setConnectedSocket] = useState(null);

  useEffect(() => {
    if (!socket) return undefined;
    const up = () => setConnectedSocket(socket);
    const down = () => setConnectedSocket(null);
    socket.on('connect', up);
    socket.on('disconnect', down);
    socket.connect();
    return () => {
      socket.off('connect', up);
      socket.off('disconnect', down);
      socket.close();
    };
  }, [socket]);

  const value = useMemo(
    () => ({ socket, connected: connectedSocket === socket && socket !== null }),
    [socket, connectedSocket],
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
