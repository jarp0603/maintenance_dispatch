import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("clientEnv", () => {
  it("loads successfully when Supabase vars are unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { clientEnv } = await import("./env.client");

    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("throws a descriptive error when a set variable is malformed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";

    await expect(import("./env.client")).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
