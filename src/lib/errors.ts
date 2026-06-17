interface AppErrorOptions {
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, options?: AppErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 500;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

interface SafeErrorBody {
  error: string;
  code: string;
}

interface SafeErrorResponse {
  body: SafeErrorBody;
  statusCode: number;
}

/**
 * Converts any thrown value into a response body safe to return to a client.
 * Unrecognized errors are collapsed to a generic message so internals
 * (stack traces, query text, library error messages) never reach the browser.
 */
export function toSafeErrorResponse(error: unknown): SafeErrorResponse {
  if (isAppError(error)) {
    return { body: { error: error.message, code: error.code }, statusCode: error.statusCode };
  }
  return {
    body: { error: "Something went wrong. Please try again.", code: "internal_error" },
    statusCode: 500,
  };
}
