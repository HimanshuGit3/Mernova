import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_URI_TEST: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().min(1, 'CLIENT_ORIGIN is required'),
  UPLOAD_DIR: z.string().default('uploads'),
  SEED_PASSWORD: z.string().optional(),
  CAMPUS_CENTER_LAT: z.coerce.number().min(-90).max(90).default(13.1718),
  CAMPUS_CENTER_LNG: z.coerce.number().min(-180).max(180).default(77.5362),
  AI_TRIAGE_ENABLED: bool.default(true),
  AI_MODEL_ID: z.string().default('Xenova/clip-vit-base-patch32'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  DUPLICATE_RADIUS_M: z.coerce.number().positive().default(50),
  DUPLICATE_SIMILARITY: z.coerce.number().min(0).max(1).default(0.85),
  AUTO_CLOSE_HOURS: z.coerce.number().positive().default(72),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    // Fail fast (NFR-04): never start with a broken configuration.
    console.error(`Invalid server configuration:\n${problems.join('\n')}\nSee server/.env.example`);
    process.exit(1);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'test' && env.MONGODB_URI_TEST) env.MONGODB_URI = env.MONGODB_URI_TEST;
  return Object.freeze(env);
}

export const env = load();
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
