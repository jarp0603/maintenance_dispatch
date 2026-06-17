import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Verified, request-cached lookup of the signed-in user. Uses `getUser()`,
 * which contacts the Supabase Auth server -- never `getSession()`, whose
 * cookie-derived user is not verified and must not be used for authorization.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
});

/** Call from any protected page, layout, server action, or route handler. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
