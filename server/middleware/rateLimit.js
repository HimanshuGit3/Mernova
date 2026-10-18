import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

/** Per-IP limiter for login and register (NFR-07). */
export function authLimiter({ max = env.RATE_LIMIT_AUTH_MAX, windowMs = 15 * 60 * 1000 } = {}) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' },
      }),
  });
}
