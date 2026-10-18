import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/users.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate, idParams, pagination } from '../middleware/validate.js';
import { CATEGORIES, ROLES } from '../utils/constants.js';

const skills = z
  .array(z.enum(CATEGORIES))
  .max(CATEGORIES.length)
  .transform((s) => [...new Set(s)]);

const listQuery = z.object({
  role: z.enum(ROLES).optional(),
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  ...pagination,
});

const createBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    role: z.enum(['technician', 'admin']),
    department: z.string().trim().max(80).optional().default(''),
    skills: skills.optional().default([]),
  })
  .refine((u) => u.role !== 'technician' || u.skills.length > 0, {
    path: ['skills'],
    message: 'Pick at least one skill for a technician',
  });

const updateBody = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    department: z.string().trim().max(80).optional(),
    skills: skills.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });

export function userRoutes() {
  const r = Router();
  r.use(auth, requireRole('admin'));
  r.get('/', validate({ query: listQuery }), ctrl.list);
  r.post('/', validate({ body: createBody }), ctrl.create);
  r.patch('/:id', validate({ params: idParams, body: updateBody }), ctrl.update);
  return r;
}
