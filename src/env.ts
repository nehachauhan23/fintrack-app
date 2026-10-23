import { z } from "zod";
import "dotenv/config";

const DEFAULT_TEXT_MODELS = "openai/gpt-oss-120b:free,google/gemma-4-31b-it:free,openrouter/free";
const DEFAULT_VISION_MODELS = "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,openrouter/free";

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.url().default("http://localhost:3000"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODELS: csv(DEFAULT_TEXT_MODELS),
  OPENROUTER_VISION_MODELS: csv(DEFAULT_VISION_MODELS),
  OPENROUTER_DATA_COLLECTION: z.enum(["deny", "allow"]).default("deny"),
  AI_USER_DAILY_LIMIT: z.coerce.number().int().min(0).default(20),
  AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(0).default(45),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(45_000),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("FinTrack <onboarding@resend.dev>"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
});

export type Env = z.infer<typeof schema>;

/** Treats empty strings (`KEY=""` in .env files) as unset. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));

  
  const result = schema.safeParse(cleaned);
  
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
