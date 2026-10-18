import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Real environment variables win over .env (dotenv never overrides them).
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  // Safe default: without an explicit NODE_ENV the server behaves as production (no stack traces).
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().min(0).default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_URI_TEST: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+\s*(ms|s|m|h|d|w|y)?$/i, 'Use a duration like 7d, 12h or 3600')
    .default('7d'),
  CLIENT_ORIGIN: z.string().min(1, 'CLIENT_ORIGIN is required'),
  UPLOAD_DIR: z.string().default('uploads'),
  SEED_PASSWORD: z.string().optional(),
  CAMPUS_CENTER_LAT: z.coerce.number().min(-90).max(90).default(13.1718),
  CAMPUS_CENTER_LNG: z.coerce.number().min(-180).max(180).default(77.5362),
  AI_TRIAGE_ENABLED: bool.default(true),
  AI_MODEL_ID: z.string().default('Xenova/clip-vit-base-patch32'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  DUPLICATE_RADIUS_M: z.coerce.number().positive().default(50),
  DUPLICATE_SIMILARITY: z.coerce.number().min(0).max(1).default(0.88),
  AUTO_CLOSE_HOURS: z.coerce.number().positive().default(72),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
});

function fail(problems) {
  // Fail fast (NFR-04): never start with a broken configuration.
  console.error(`Invalid server configuration:\n${problems.join('\n')}\nSee server/.env.example`);
  process.exit(1);
}

/**
 * Validate a set of variables. Pure (no exit), so it can be unit-tested.
 * @returns {{ env?: object, problems: string[] }}
 */
export function parseEnv(source) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    return { problems: parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`) };
  }
  const env = { ...parsed.data, SERVER_ROOT: serverRoot };
  if (env.NODE_ENV === 'test') {
    // Tests wipe their database, so they must never point at the development one.
    if (!env.MONGODB_URI_TEST)
      return { problems: ['  - MONGODB_URI_TEST: required when NODE_ENV=test'] };
    if (!/test/i.test(env.MONGODB_URI_TEST)) {
      return { problems: ['  - MONGODB_URI_TEST: database name must contain "test"'] };
    }
    env.MONGODB_URI = env.MONGODB_URI_TEST;
  }
  env.UPLOAD_PATH = path.resolve(serverRoot, env.UPLOAD_DIR);
  return { env: Object.freeze(env), problems: [] };
}

function load() {
  const { env, problems } = parseEnv(process.env);
  if (problems.length) fail(problems);
  return env;
}

export const env = load();
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
export const isProd = env.NODE_ENV === 'production';
