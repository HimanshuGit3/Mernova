import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app);
server.listen(env.PORT, () => {
  console.log(`FixIt Campus API listening on http://127.0.0.1:${env.PORT}`);
});
