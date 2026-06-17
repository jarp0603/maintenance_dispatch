import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env.client";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the session via cookies and is subject to RLS as the signed-in
 * user (`auth.uid()` resolves to their id) -- never bypasses ownership checks.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies cannot be set.
            // Safe to ignore as long as proxy.ts is refreshing the session.
          }
        },
      },
    },
  );
}
