import http from 'node:http';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../app.js';
import { initSocket, closeSocket } from '../services/socket.js';

/** Start the app + Socket.IO on a free port (the test DB is already connected by setup.js). */
export async function startTestServer() {
  const app = createApp({ authRateLimitMax: 1000 });
  const server = http.createServer(app);
  const io = initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { app, url, stop: () => closeSocket(io) };
}

/** Connect and wait for the server's `ready` event; rejects with the connect_error. */
export function connect(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    socket.events = [];
    socket.onAny((event, payload) => socket.events.push({ event, payload }));
    socket.once('ready', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

/** Resolve with the first `event` payload matching `predicate` (also checks already-received events). */
export function waitFor(socket, event, predicate = () => true, timeoutMs = 4000) {
  const seen = socket.events.find((e) => e.event === event && predicate(e.payload));
  if (seen) return Promise.resolve(seen.payload);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
