import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/auth.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'))
  .pipe(z.string().max(254));
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
  department: z.string().trim().max(80).optional().default(''),
});
const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});
const logoutSchema = z
  .object({ fcmToken: z.string().max(4096).optional() })
  .optional()
  .default({});
const fcmSchema = z.object({ token: z.string().min(10).max(4096) });

export function authRoutes({ limiter }) {
  const r = Router();
  r.post('/register', limiter, validate({ body: registerSchema }), ctrl.register);
  r.post('/login', limiter, validate({ body: loginSchema }), ctrl.login);
  r.get('/me', auth, ctrl.me);
  r.post('/logout', auth, validate({ body: logoutSchema }), ctrl.logout);
  r.post('/fcm-token', auth, validate({ body: fcmSchema }), ctrl.saveFcmToken);
  return r;
}
