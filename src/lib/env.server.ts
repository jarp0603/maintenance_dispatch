import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Google OAuth / Gmail — required starting Phase 5.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GMAIL_SEARCH_QUERY: z.string().min(1).optional(),

  // Calendly — required starting Phase 8.
  CALENDLY_PERSONAL_ACCESS_TOKEN: z.string().min(1).optional(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
  CALENDLY_ORGANIZATION_URI: z.string().url().optional(),

  // App — base URL used to build links from server code (e.g. tenant emails).
  APP_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const serverEnv = loadServerEnv();
