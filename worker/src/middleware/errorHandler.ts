import type { ErrorResponse } from "../types/glossary";

// ── Standard error status codes ───────────────────────────────────────────────

export const HTTP = {
  BAD_REQUEST:   400,
  UNAUTHORIZED:  401,
  NOT_FOUND:     404,
  SERVER_ERROR:  500,
} as const;

// ── AppError ──────────────────────────────────────────────────────────────────
// Throw this anywhere in the Worker to produce a clean error response.
// Never throw raw Error objects — they may leak stack traces.

export class AppError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status  = status;
    this.name    = "AppError";
  }
}

// ── errorResponse ─────────────────────────────────────────────────────────────
// Builds the fixed-shape error JSON defined in the guideline:
// { status, message } — no stack traces, no internal paths, ever.

export function errorResponse(status: number, message: string): Response {
  const body: ErrorResponse = { status, message };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── withErrorHandler ──────────────────────────────────────────────────────────
// Wraps any route handler so unhandled throws are caught and returned
// as clean JSON instead of bubbling up as a 500 with a raw error string.
//
// Usage:
//   return withErrorHandler(() => handleGlossaryRoute(request, env));

export async function withErrorHandler(
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    // Known AppError — use its status and message directly
    if (err instanceof AppError) {
      return errorResponse(err.status, err.message);
    }

    // Unknown error — log internally, return generic 500
    // Never expose err.message to the client in production
    console.error("[Worker error]", err);
    return errorResponse(HTTP.SERVER_ERROR, "An unexpected error occurred");
  }
}