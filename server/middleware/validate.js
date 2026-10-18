import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/** Turn zod issues into the `details` array of the error shape. */
export function zodDetails(error) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Validate `body`, `query` and/or `params` with zod schemas (NFR-03).
 * Parsed values go to `req.valid.{body,query,params}`; `req.body` is replaced too.
 * (Express 5 makes `req.query` read-only, so handlers read `req.valid.query`.)
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid ??= {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(ApiError.badRequest('Invalid request', zodDetails(result.error)));
      }
      req.valid[part] = result.data;
      if (part === 'body') req.body = result.data;
    }
    next();
  };
}

// Shared building blocks
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });
export const pagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};
/** A comma separated list in a query string, e.g. `status=open,assigned`. */
export const csvEnum = (values) =>
  z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).min(1));
