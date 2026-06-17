import { describe, it, expect } from "vitest";
import { AppError, isAppError, toSafeErrorResponse } from "./errors";

describe("AppError", () => {
  it("carries a machine-readable code and status code", () => {
    const error = new AppError("not_found", "Work order not found", { statusCode: 404 });

    expect(isAppError(error)).toBe(true);
    expect(error.code).toBe("not_found");
    expect(error.statusCode).toBe(404);
  });
});

describe("toSafeErrorResponse", () => {
  it("passes through AppError messages", () => {
    const error = new AppError("validation_error", "Tenant email is required", {
      statusCode: 400,
    });

    expect(toSafeErrorResponse(error)).toEqual({
      body: { error: "Tenant email is required", code: "validation_error" },
      statusCode: 400,
    });
  });

  it("collapses unknown errors to a generic message", () => {
    const result = toSafeErrorResponse(new Error("connection string: postgres://user:pw@host"));

    expect(result.statusCode).toBe(500);
    expect(result.body.code).toBe("internal_error");
    expect(result.body.error).not.toMatch(/postgres/);
  });
});
