import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env.client";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * Use ONLY for trusted server-side code that has no authenticated user
 * session to act as: Gmail import jobs, Calendly webhook handlers, public
 * tenant-link handlers, and reminder/cron jobs. Every query made with this
 * client MUST filter by `owner_id` explicitly -- the database will not do it.
 *
 * Never import this into a Client Component or any code path that runs in
 * the browser.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
