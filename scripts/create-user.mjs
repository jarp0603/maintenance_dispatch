// One-off operator script: this app has no public sign-up page by design
// (see supabase/config.toml, enable_signup = false). Run this to provision
// the operator account locally, or against a production project once
// migrated, by pointing it at that project's env vars.
//
// Usage: npm run create-user -- <email> <password>
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npm run create-user -- <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error(`Failed to create user: ${error.message}`);
  process.exit(1);
}

console.log(`Created user ${data.user.email} (${data.user.id}).`);
