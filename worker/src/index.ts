import type { Env } from "./types/glossary";
import { handleGlossaryRoute } from "./routes/glossary";
import { handleAdminRoute } from "./routes/admin";
import { handleSyncRoute } from "./routes/sync";
import { flushRetryQueue } from "./services/retryQueue";
import { errorResponse, HTTP } from "./middleware/errorHandler";
import { isAdminRoute } from "./middleware/auth";

// ── Main Worker entry point ───────────────────────────────────────────────────
// All incoming requests are routed here first.
// Structure:
//   GET  /glossary/:tab          → handleGlossaryRoute (public)
//   POST /admin/words            → handleAdminRoute    (auth required)
//   PATCH /admin/words/:id       → handleAdminRoute    (auth required)
//   DELETE /admin/words/:id      → handleAdminRoute    (auth required)
//   POST /sync                   → handleSyncRoute     (auth required)
//   *                            → 404

export default {
  // ── HTTP handler ────────────────────────────────────────────────────────────
  async fetch(
    request: Request,
    env:     Env,
    _ctx:    ExecutionContext
  ): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ── Route matching ───────────────────────────────────────────────────────
    try {
      // Public read routes
      if (pathname.startsWith("/glossary/")) {
        return await handleGlossaryRoute(request, env);
      }

      // Protected write routes
      if (pathname.startsWith("/admin/")) {
        return await handleAdminRoute(request, env);
      }

      // Protected sync route
      if (pathname.startsWith("/sync")) {
        return await handleSyncRoute(request, env);
      }

      // OPTIONS preflight for any path — handle at top level too
      if (request.method === "OPTIONS") {
        const origin = request.headers.get("Origin") ?? "";
        const allowed = env.CORS_ALLOWED_ORIGINS
          .split(",")
          .map((o) => o.trim())
          .includes(origin);

        if (allowed) {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin":  origin,
              "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
              "Access-Control-Max-Age":       "86400",
            },
          });
        }
      }

      // No route matched
      return errorResponse(HTTP.NOT_FOUND, "Route not found");

    } catch (err) {
      // Top-level safety net — should rarely fire since each route
      // handler wraps itself in withErrorHandler
      console.error("[index] Unhandled error:", err);
      return errorResponse(HTTP.SERVER_ERROR, "An unexpected error occurred");
    }
  },

  // ── Cron handler ─────────────────────────────────────────────────────────────
  // Triggered by the cron schedule in wrangler.toml: "0 * * * *" (hourly)
  // Flushes any pending Sheets sync entries that failed during normal operation.
  async scheduled(
    _event:      ScheduledEvent,
    env:         Env,
    _ctx:        ExecutionContext
  ): Promise<void> {
    console.log("[cron] retryQueue flush started");
    try {
      await flushRetryQueue(env);
    } catch (err) {
      console.error("[cron] retryQueue flush failed:", err);
    }
    console.log("[cron] retryQueue flush complete");
  },
};