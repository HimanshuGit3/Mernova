import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/issues.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate, idParams, objectId, pagination, csvEnum } from '../middleware/validate.js';
import { photoUpload } from '../middleware/upload.js';
import { CATEGORIES, SEVERITIES, STATUSES } from '../utils/constants.js';

/** Multipart forms send every field as a string; treat "" as "not provided". */
const blank = (schema) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema);

export const createIssueSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
    description: blank(z.string().trim().max(1000).optional()).default(''),
    category: z.enum(CATEGORIES, { error: 'Pick a category' }),
    severity: blank(z.enum(SEVERITIES).optional()).default('medium'),
    lat: blank(z.coerce.number().min(-90).max(90).optional()),
    lng: blank(z.coerce.number().min(-180).max(180).optional()),
    locationId: blank(objectId.optional()),
    landmark: blank(z.string().trim().max(120).optional()),
    clientRequestId: blank(
      z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{8,64}$/, 'Invalid request id')
        .optional(),
    ),
    aiSuggestedCategory: blank(z.enum(CATEGORIES).optional()),
    aiConfidence: blank(z.coerce.number().min(0).max(1).optional()),
  })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), {
    path: ['lng'],
    message: 'Send both lat and lng, or neither',
  })
  .refine((b) => b.locationId || b.lat !== undefined || b.landmark, {
    path: ['landmark'],
    message: 'Add a landmark when there is no GPS or room QR',
  });

const listQuery = z.object({
  status: csvEnum(STATUSES).optional(),
  category: csvEnum(CATEGORIES).optional(),
  severity: csvEnum(SEVERITIES).optional(),
  building: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'due']).default('newest'),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  mine: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  assignedTo: objectId.optional(),
  ...pagination,
});

export const exportQuery = listQuery.omit({ page: true, limit: true, sort: true });

const feedQuery = z.object({ ...pagination });

const patchBody = z
  .object({
    title: z.string().trim().min(3).max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    severity: z.enum(SEVERITIES).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });

const assignBody = z.object({
  technicianId: objectId,
  note: z.string().trim().max(500).optional(),
});

const transitionBody = z.object({
  to: z.enum(['in_progress', 'resolved', 'closed', 'reopened', 'rejected'], {
    error: 'Unknown target status',
  }),
  note: blank(z.string().trim().max(500).optional()).default(''),
  reason: blank(z.string().trim().max(500).optional()).default(''),
  duplicateOf: blank(objectId.optional()),
});

const whereFields = {
  lat: blank(z.coerce.number().min(-90).max(90).optional()),
  lng: blank(z.coerce.number().min(-180).max(180).optional()),
  locationId: blank(objectId.optional()),
};
const bothOrNeither = (b) => (b.lat === undefined) === (b.lng === undefined);

const analyseBody = z
  .object({ ...whereFields, category: blank(z.enum(CATEGORIES).optional()) })
  .refine(bothOrNeither, { path: ['lng'], message: 'Send both lat and lng, or neither' });

const duplicatesQuery = z
  .object({ ...whereFields, category: blank(z.enum(CATEGORIES).optional()) })
  .refine(bothOrNeither, { path: ['lng'], message: 'Send both lat and lng, or neither' })
  .refine((q) => q.locationId || q.lat !== undefined, {
    path: ['lat'],
    message: 'Send a location (lat/lng or locationId)',
  });

export function issueRoutes() {
  const r = Router();
  r.use(auth);
  // AI triage + duplicate check before a report is created (FR-51, FR-52)
  r.post(
    '/analyse',
    requireRole('student', 'admin'),
    photoUpload,
    validate({ body: analyseBody }),
    ctrl.analyse,
  );
  r.get(
    '/duplicates',
    requireRole('student', 'admin'),
    validate({ query: duplicatesQuery }),
    ctrl.duplicates,
  );
  r.get('/', validate({ query: listQuery }), ctrl.list);
  r.get('/feed', validate({ query: feedQuery }), ctrl.feed);
  r.post(
    '/',
    requireRole('student', 'admin'),
    photoUpload,
    validate({ body: createIssueSchema }),
    ctrl.create,
  );
  r.get('/:id', validate({ params: idParams }), ctrl.get);
  r.patch(
    '/:id',
    requireRole('admin'),
    validate({ params: idParams, body: patchBody }),
    ctrl.patch,
  );
  r.post('/:id/support', requireRole('student'), validate({ params: idParams }), ctrl.support);
  r.get(
    '/:id/assignment-suggestions',
    requireRole('admin'),
    validate({ params: idParams }),
    ctrl.suggestions,
  );
  r.post(
    '/:id/assign',
    requireRole('admin'),
    validate({ params: idParams, body: assignBody }),
    ctrl.assign,
  );
  r.post(
    '/:id/transition',
    photoUpload,
    validate({ params: idParams, body: transitionBody }),
    ctrl.transition,
  );
  return r;
}
