import { Server } from 'socket.io';
import { allowedOrigins } from '../app.js';
import { userFromToken } from '../middleware/auth.js';
import { attachIo, detachIo, rooms } from './realtime.js';

/**
 * Socket.IO on the same HTTP server as the API (D4).
 * The JWT travels in the handshake (`auth.token`); the same check as HTTP `auth` runs once
 * per connection. Each socket joins `user:<id>`; admins also join `role:admin`.
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
    serveClient: false,
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      socket.data.user = { id: String(user._id), role: user.role, name: user.name };
      next();
    } catch (err) {
      const error = new Error(err.message ?? 'Unauthenticated');
      error.data = { code: err.code ?? 'UNAUTHENTICATED' };
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(rooms.user(id));
    if (role === 'admin') socket.join(rooms.admins);
    socket.emit('ready', { userId: id, role });
  });

  attachIo(io);
  return io;
}

export async function closeSocket(io) {
  detachIo();
  await io.close();
}
