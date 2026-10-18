import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/misc.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate, idParams, pagination } from '../middleware/validate.js';
import { exportQuery } from './issues.js';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

// ---- locations
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, 'Use 2–20 letters, digits or dashes, e.g. B-204');
const locationBody = z.object({
  code,
  building: z.string().trim().min(1, 'Building is required').max(60),
  floor: z.string().trim().max(20).optional().default(''),
  room: z.string().trim().max(40).optional().default(''),
  label: z.string().trim().max(80).optional().default(''),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
const locationPatch = z
  .object({
    code: code.optional(),
    building: z.string().trim().min(1).max(60).optional(),
    floor: z.string().trim().max(20).optional(),
    room: z.string().trim().max(40).optional(),
    label: z.string().trim().max(80).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
const locationQuery = z.object({
  q: z.string().trim().max(60).optional(),
  building: z.string().trim().max(60).optional(),
  active: bool.optional(),
  ...pagination,
});

export function locationRoutes() {
  const r = Router();
  r.use(auth);
  r.get('/', validate({ query: locationQuery }), ctrl.listLocations);
  r.get('/buildings', ctrl.buildings);
  r.get(
    '/code/:code',
    validate({ params: z.object({ code: z.string().trim().min(1).max(40) }) }),
    ctrl.locationByCode,
  );
  r.post('/', requireRole('admin'), validate({ body: locationBody }), ctrl.createLocation);
  r.patch(
    '/:id',
    requireRole('admin'),
    validate({ params: idParams, body: locationPatch }),
    ctrl.updateLocation,
  );
  return r;
}

// ---- notifications
export function notificationRoutes() {
  const r = Router();
  r.use(auth);
  r.get(
    '/',
    validate({ query: z.object({ unread: bool.optional(), ...pagination }) }),
    ctrl.listNotifications,
  );
  r.post('/read-all', ctrl.readAllNotifications);
  r.post('/:id/read', validate({ params: idParams }), ctrl.readNotification);
  return r;
}

// ---- insights (admin)
const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export function insightRoutes() {
  const r = Router();
  r.use(auth, requireRole('admin'));
  r.get('/summary', ctrl.summary);
  r.get('/overview', validate({ query: daysQuery }), ctrl.overview);
  r.get('/buildings', ctrl.buildingHealth);
  r.get('/heatmap', validate({ query: daysQuery }), ctrl.heatmap);
  r.get('/attention', ctrl.attention);
  r.get(
    '/activity',
    validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }) }),
    ctrl.activity,
  );
  r.get('/live', ctrl.live);
  return r;
}

export function exportRoutes() {
  const r = Router();
  r.use(auth, requireRole('admin'));
  r.get('/issues.csv', validate({ query: exportQuery }), ctrl.exportCsv);
  return r;
}
