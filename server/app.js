import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env, isDev } from './config/env.js';
import { dbState } from './config/db.js';
import { authLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { aiStatus } from './services/ai.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { issueRoutes } from './routes/issues.js';
import { locationRoutes, notificationRoutes, insightRoutes, exportRoutes } from './routes/misc.js';

export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());

/**
 * Build the Express app without listening. Tests call this directly with supertest.
 * @param {{ authRateLimitMax?: number }} [options]
 */
export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      // Photos under /uploads are shown by the web app on another origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // CORS only for the web origin (NFR-05). Mobile apps send no Origin header.
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));
  if (isDev) app.use(morgan('dev'));

  app.use(
    '/uploads',
    express.static(env.UPLOAD_PATH, { fallthrough: false, maxAge: '7d', index: false }),
  );

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', db: dbState(), ai: aiStatus(), time: new Date().toISOString() });
  });
  api.use('/auth', authRoutes({ limiter: authLimiter({ max: options.authRateLimitMax }) }));
  api.use('/users', userRoutes());
  api.use('/issues', issueRoutes());
  api.use('/locations', locationRoutes());
  api.use('/notifications', notificationRoutes());
  api.use('/insights', insightRoutes());
  api.use('/export', exportRoutes());
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
