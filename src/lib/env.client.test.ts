import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const VALID_ENV = {
  ...ORIGINAL_ENV,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
};

beforeEach(() => {
  vi.resetModules();
  process.env = { ...VALID_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("clientEnv", () => {
  it("loads successfully with valid Supabase vars", async () => {
    const { clientEnv } = await import("./env.client");

    expect(clientEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await expect(import("./env.client")).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws a descriptive error when a set variable is malformed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";

    await expect(import("./env.client")).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
