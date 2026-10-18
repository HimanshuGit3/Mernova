import http from 'node:http';
import path from 'node:path';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { initSocket, closeSocket } from './services/socket.js';
import { startJobs } from './jobs/index.js';
import { setAiService } from './services/ai.js';
import { createClipService } from './services/clip.js';

/**
 * Start the API + Socket.IO on one HTTP server.
 * @param {{ port?: number, jobs?: boolean }} [options] port 0 picks a free port (used by e2e)
 */
export async function startServer({
  port = env.PORT,
  jobs = true,
  ai = env.AI_TRIAGE_ENABLED,
} = {}) {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  const stopJobs = jobs ? startJobs() : () => {};
  if (ai) {
    // CLIP loads in the background; until it is ready, reports simply get no suggestion.
    const clip = createClipService();
    setAiService(clip);
    clip.warmup();
  }
  await new Promise((resolve, reject) => {
    server.once('error', (err) => {
      stopJobs();
      reject(err.code === 'EADDRINUSE' ? new Error(`Port ${port} is already in use`) : err);
    });
    server.listen(port, resolve);
  });
  const actualPort = server.address().port;

  async function stop() {
    stopJobs();
    await closeSocket(io); // also closes the HTTP server
    await disconnectDb();
  }
  return { server, io, port: actualPort, stop };
}

// Run directly (`node server.js`, `node --watch server.js`); importing it (e2e) does not auto-start.
if (path.basename(process.argv[1] ?? '') === 'server.js') {
  startServer()
    .then(({ port, stop }) => {
      console.log(`FixIt Campus API + realtime on http://127.0.0.1:${port} (${env.NODE_ENV})`);
      const shutdown = async (signal) => {
        console.log(`${signal}: shutting down`);
        await stop();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error('Failed to start:', err.message);
      process.exit(1);
    });
}
