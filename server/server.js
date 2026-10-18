import http from 'node:http';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  server.listen(env.PORT, () => {
    console.log(`FixIt Campus API listening on http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
