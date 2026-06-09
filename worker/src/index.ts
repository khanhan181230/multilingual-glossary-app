import type { Env } from "./types/glossary";
import { handleGlossaryRoute } from "./routes/glossary";
import { handleAdminRoute } from "./routes/admin";
import { handleSyncRoute } from "./routes/sync";
import { flushRetryQueue } from "./services/retryQueue";
import { errorResponse, HTTP } from "./middleware/errorHandler";

export default {
  // ── HTTP handler ─────────────────────────────────────────────────────────────
  async fetch(
    request: Request,
    env:     Env,
    _ctx:    ExecutionContext
  ): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ── Handle OPTIONS preflight before anything else ─────────────────────────
    // Must be first — before auth, before routing, before everything.
    // Also adds CF-Access-JWT-Assertion to allowed headers so the browser
    // doesn't block the actual request after preflight passes.
    if (request.method === "OPTIONS") {
      const origin  = request.headers.get("Origin") ?? "";
      const allowed = env.CORS_ALLOWED_ORIGINS
        .split(",")
        .map(o => o.trim())
        .includes(origin);

      if (allowed) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin":  origin,
            "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, CF-Access-JWT-Assertion, CF-Access-Client-Id, CF-Access-Client-Secret",
            "Access-Control-Max-Age":       "86400",
          },
        });
      }
      return new Response(null, { status: 403 });
    }

    // ── Route matching ────────────────────────────────────────────────────────
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

      // No route matched
      return errorResponse(HTTP.NOT_FOUND, "Route not found");

    } catch (err) {
      console.error("[index] Unhandled error:", err);
      return errorResponse(HTTP.SERVER_ERROR, "An unexpected error occurred");
    }
  },

  // ── Cron handler ──────────────────────────────────────────────────────────────
  // Triggered hourly by the cron schedule in wrangler.toml: "0 * * * *"
  async scheduled(
    _event: ScheduledEvent,
    env:    Env,
    _ctx:   ExecutionContext
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