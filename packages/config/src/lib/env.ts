import { z } from "zod";
import { loadWorkspaceEnv } from "./load-env";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const apiEnvSchema = z.object({
  APP_NAME: z.string().min(1),
  NODE_ENV: nodeEnvSchema,
  WEB_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  MEDIA_PUBLIC_URL: z.string().url(),
  REALTIME_PUBLIC_URL: z.string().url(),
  REALTIME_PATH: z.string().min(1),
  WEB_PORT: z.coerce.number().int().positive(),
  WEB_HOST: z.string().min(1),
  API_PORT: z.coerce.number().int().positive(),
  API_HOST: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIX: z.string().min(1).default("lobby"),
  SESSION_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().min(1).default("lobby_session"),
  SESSION_COOKIE_DOMAIN: z.string().min(1).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ARGON2_MEMORY_COST: z.coerce.number().int().positive(),
  ARGON2_TIME_COST: z.coerce.number().int().positive(),
  ARGON2_PARALLELISM: z.coerce.number().int().positive(),
  LIVEKIT_URL: z.string().url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(120),
  CALL_RING_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(45),
  UPLOAD_DRIVER: z.enum(["local", "s3"]),
  UPLOAD_LOCAL_ROOT: z.string().min(1),
  MAX_AVATAR_MB: z.coerce.number().positive(),
  MAX_AVATAR_FRAMES: z.coerce.number().int().positive().default(180),
  MAX_AVATAR_ANIMATION_MS: z.coerce.number().int().positive().default(10000),
  MAX_RINGTONE_MB: z.coerce.number().positive().default(25),
  MAX_FILE_MB: z.coerce.number().positive(),
  REALTIME_CORS_ORIGIN: z.string().url(),
});

const seedEnvSchema = apiEnvSchema.extend({
  SEED_OWNER_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_OWNER_USERNAME: z.string().trim().min(3).max(24),
  SEED_OWNER_DISPLAY_NAME: z.string().trim().min(2).max(40),
  SEED_OWNER_PASSWORD: z.string().min(12).max(128),
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_ADMIN_USERNAME: z.string().trim().min(3).max(24),
  SEED_ADMIN_DISPLAY_NAME: z.string().trim().min(2).max(40),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
  SEED_OWNER_INVITE_KEY: z.string().trim().toUpperCase(),
  SEED_ADMIN_INVITE_KEY: z.string().trim().toUpperCase(),
  SEED_MEMBER_INVITE_KEY: z.string().trim().toUpperCase(),
});

const webEnvSchema = z.object({
  APP_NAME: z.string().min(1),
  NODE_ENV: nodeEnvSchema.default("development"),
  WEB_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  MEDIA_PUBLIC_URL: z.string().url(),
  REALTIME_PUBLIC_URL: z.string().url(),
  REALTIME_PATH: z.string().min(1),
  WEB_PORT: z.coerce.number().int().positive(),
  WEB_HOST: z.string().min(1),
  MAX_AVATAR_MB: z.coerce.number().positive(),
  MAX_AVATAR_ANIMATION_MS: z.coerce.number().int().positive(),
  MAX_RINGTONE_MB: z.coerce.number().positive().default(25),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  loadWorkspaceEnv();
  return apiEnvSchema.parse(env);
}

export function parseWebEnv(env: NodeJS.ProcessEnv): WebEnv {
  loadWorkspaceEnv();
  return webEnvSchema.parse(env);
}

export function parseSeedEnv(env: NodeJS.ProcessEnv): SeedEnv {
  loadWorkspaceEnv();
  return seedEnvSchema.parse(env);
}
