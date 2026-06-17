// `server-only` resolves to a no-op via the bundler's "react-server" export
// condition, which only Next.js's own build sets. Mock it here so the test
// exercises the validation logic without depending on that condition.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORIGINAL_ENV = { ...process.env };
const VALID_ENV = {
  ...ORIGINAL_ENV,
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

beforeEach(() => {
  vi.resetModules();
  process.env = { ...VALID_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("serverEnv", () => {
  it("loads successfully when phase 5+ vars are unset", async () => {
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    delete process.env.CALENDLY_ORGANIZATION_URI;

    const { serverEnv } = await import("./env.server");

    expect(serverEnv.GOOGLE_OAUTH_REDIRECT_URI).toBeUndefined();
    expect(serverEnv.CALENDLY_ORGANIZATION_URI).toBeUndefined();
  });

  it("throws a descriptive error when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import("./env.server")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("throws a descriptive error when a set variable is malformed", async () => {
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "not-a-url";

    await expect(import("./env.server")).rejects.toThrow(/GOOGLE_OAUTH_REDIRECT_URI/);
  });
});
