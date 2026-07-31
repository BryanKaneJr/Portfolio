import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 *
 * This is the ONLY module permitted to read `process.env` directly (enforced by
 * ESLint `no-restricted-globals`). Import the typed `env` object everywhere else.
 * Validation runs once at module load, so a misconfigured deployment fails fast
 * and loudly rather than misbehaving at runtime (blueprint §14.2).
 *
 * Server-only secrets (e.g. OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) must never
 * be imported into client bundles. Keep this module out of client components.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_ANSWER_MODEL: z.string().min(1).default("gpt-economical"),
  OPENAI_COMPLEX_MODEL: z.string().min(1).default("gpt-strong"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),

  AI_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ANON_DAILY_QUOTA: z.coerce.number().int().positive().default(10),
  ACCOUNT_DAILY_QUOTA: z.coerce.number().int().positive().default(50),
  MONTHLY_SPEND_LIMIT_USD: z.coerce.number().positive().default(50),

  SCRYFALL_USER_AGENT: z.string().min(1).default("CommanderCompanion/0.0"),
  RULES_SOURCE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/**
 * Parse and cache server environment. Throws a readable error listing every
 * invalid/missing variable on first access.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Convenience accessor. Prefer `getServerEnv()` in code paths that must be lazy. */
export const env: ServerEnv = /* @__PURE__ */ new Proxy({} as ServerEnv, {
  get(_t, prop: string) {
    return getServerEnv()[prop as keyof ServerEnv];
  },
});
