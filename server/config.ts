import loadLocalEnv from "../script/load-local-env.cjs";
import { z } from "zod";

loadLocalEnv();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters")
    .default("dev-session-secret-change-me"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  AWS_S3_BUCKET: z.string().trim().min(1).optional(),
  AWS_REGION: z.string().trim().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  AWS_S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).optional(),
  AWS_S3_READ_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).optional(),
  OBJECT_STORAGE_BUCKET: z.string().trim().min(1).optional(),
  OBJECT_STORAGE_REGION: z.string().trim().min(1).optional(),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().trim().url().optional(),
  OBJECT_STORAGE_PUBLIC_BASE_URL: z.string().trim().url().optional(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).optional(),
  OBJECT_STORAGE_READ_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).optional(),
  CLIENT_VIDEO_MAX_SIZE_MB: z.coerce.number().int().min(10).max(2000).default(250),
});

type ParsedEnv = z.infer<typeof envSchema>;

export type AppConfig = ParsedEnv & {
  OBJECT_STORAGE_REGION: string;
  OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS: number;
  OBJECT_STORAGE_READ_URL_TTL_SECONDS: number;
};

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const raw = parsed.data;
  cachedConfig = {
    ...raw,
    OBJECT_STORAGE_BUCKET: raw.OBJECT_STORAGE_BUCKET || raw.AWS_S3_BUCKET,
    OBJECT_STORAGE_REGION: raw.OBJECT_STORAGE_REGION || raw.AWS_REGION || "us-east-1",
    OBJECT_STORAGE_ACCESS_KEY_ID: raw.OBJECT_STORAGE_ACCESS_KEY_ID || raw.AWS_ACCESS_KEY_ID,
    OBJECT_STORAGE_SECRET_ACCESS_KEY:
      raw.OBJECT_STORAGE_SECRET_ACCESS_KEY || raw.AWS_SECRET_ACCESS_KEY,
    OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS:
      raw.OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS ?? raw.AWS_S3_UPLOAD_URL_TTL_SECONDS ?? 900,
    OBJECT_STORAGE_READ_URL_TTL_SECONDS:
      raw.OBJECT_STORAGE_READ_URL_TTL_SECONDS ?? raw.AWS_S3_READ_URL_TTL_SECONDS ?? 3600,
  };
  if (
    cachedConfig.NODE_ENV === "production" &&
    cachedConfig.SESSION_SECRET === "dev-session-secret-change-me"
  ) {
    throw new Error("Invalid environment configuration: SESSION_SECRET must be set in production");
  }
  return cachedConfig;
}
