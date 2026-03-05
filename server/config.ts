import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters")
    .default("dev-session-secret-change-me"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type AppConfig = z.infer<typeof envSchema>;

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

  cachedConfig = parsed.data;
  if (
    cachedConfig.NODE_ENV === "production" &&
    cachedConfig.SESSION_SECRET === "dev-session-secret-change-me"
  ) {
    throw new Error("Invalid environment configuration: SESSION_SECRET must be set in production");
  }
  return cachedConfig;
}
