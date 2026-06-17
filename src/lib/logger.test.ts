import { describe, it, expect, vi, afterEach } from "vitest";
import { logger, redact } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redact", () => {
  it("masks keys that look sensitive, recursively", () => {
    const result = redact({
      tenantEmail: "tenant@example.com",
      nested: { phone: "555-1234", note: "fine" },
    });

    expect(result).toEqual({
      tenantEmail: "[redacted]",
      nested: { phone: "[redacted]", note: "fine" },
    });
  });

  it("leaves non-sensitive fields untouched", () => {
    expect(redact({ status: "Scheduled", count: 3 })).toEqual({
      status: "Scheduled",
      count: 3,
    });
  });
});

describe("logger", () => {
  it("redacts sensitive fields before writing info logs to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("imported work order", { tenantEmail: "tenant@example.com", status: "New" });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(logged.tenantEmail).toBe("[redacted]");
    expect(logged.status).toBe("New");
  });

  it("writes errors via console.error with redaction applied", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("gmail import failed", { tenantEmail: "tenant@example.com", reason: "timeout" });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(logged.tenantEmail).toBe("[redacted]");
    expect(logged.reason).toBe("timeout");
  });
});
