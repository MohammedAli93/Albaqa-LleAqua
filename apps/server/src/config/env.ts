/**
 * Environment configuration. Validated once at boot with Zod — the process
 * refuses to start on missing/invalid config (fail fast, never run misconfigured).
 */
import 'dotenv/config'; // load apps/server/.env in dev (no-op if absent)
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  PUBLIC_API_URL: z.string().url(),
  PUBLIC_SCREEN_URL: z.string().url(),
  PUBLIC_CONTROLLER_URL: z.string().url(),
  PUBLIC_ADMIN_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  TOKEN_PEPPER: z.string().min(16),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().url(),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  // AI question generation (Claude). When ANTHROPIC_API_KEY is empty, generation
  // is disabled and games fall back to the seeded package questions.
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  QUESTION_MODEL: z.string().default('claude-opus-4-8'),
  // Target pool size kept per category; a game tops the pool up on demand.
  QUESTIONS_MIN_PER_CATEGORY: z.coerce.number().int().default(30),

  SENTRY_DSN: z.string().optional().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional().default(''),
  OTEL_SERVICE_NAME: z.string().default('tahaddi-server'),

  GAME_MAX_PLAYERS: z.coerce.number().int().default(100),
  GAME_DEFAULT_TIMER_SEC: z.coerce.number().int().default(15),
  GAME_RECONNECT_GRACE_SEC: z.coerce.number().int().default(45),
  GAME_ROOM_TTL_SEC: z.coerce.number().int().default(7200),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`❌ Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** CORS allowlist — the three app origins. */
export const ALLOWED_ORIGINS = [
  env.PUBLIC_SCREEN_URL,
  env.PUBLIC_CONTROLLER_URL,
  env.PUBLIC_ADMIN_URL,
];
