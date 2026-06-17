import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

/** Supabase client for Client Components. Subject to RLS, same as the server client. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
