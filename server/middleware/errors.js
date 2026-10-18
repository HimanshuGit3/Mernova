import multer from 'multer';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { zodDetails } from './validate.js';
import { isDev, isTest } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
}

function normalise(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return ApiError.badRequest('Invalid request', zodDetails(err));
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0];
    return ApiError.conflict(
      field ? `That ${field} is already in use` : 'Already exists',
      'CONFLICT',
      field ? [{ path: field, message: 'Already in use' }] : undefined,
    );
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return ApiError.badRequest('Photo must be 5 MB or smaller', undefined, 'FILE_TOO_LARGE');
    return ApiError.badRequest(err.message, undefined, 'INVALID_FILE');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.badRequest('Invalid request', details);
  }
  if (err instanceof mongoose.Error.CastError) return ApiError.notFound();
  if (err?.status === 404 || err?.statusCode === 404) return ApiError.notFound();
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err?.type === 'entity.too.large') return ApiError.badRequest('Request body too large');
  return null;
}

// Express recognises error handlers by their four parameters.
export function errorHandler(err, req, res, _next) {
  const known = normalise(err);
  if (known) {
    const body = { error: { code: known.code, message: known.message } };
    if (known.details) body.error.details = known.details;
    return res.status(known.status).json(body);
  }
  if (!isTest) console.error(err);
  const body = { error: { code: 'INTERNAL', message: 'Something went wrong' } };
  // Stack traces only in development (NFR-09).
  if (isDev) body.error.details = { message: err?.message, stack: err?.stack };
  res.status(500).json(body);
}
