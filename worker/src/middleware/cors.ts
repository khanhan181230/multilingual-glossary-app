import type { Env } from "../types/glossary";
import { errorResponse, HTTP } from "./errorHandler";

// ── CORS headers builder ──────────────────────────────────────────────────────
// Only called after the origin has been validated.
// Returns the minimal set of headers needed for the frontend to read responses.

function buildCorsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin":      origin,
    "Access-Control-Allow-Methods":     "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type, Authorization",
    "Access-Control-Max-Age":           "86400", // preflight cache: 24 hours
  };
}

// ── isAllowedOrigin ───────────────────────────────────────────────────────────
// Reads CORS_ALLOWED_ORIGINS from env (comma-separated) and checks the
// incoming origin against the list. Never falls back to wildcard "*".

function isAllowedOrigin(origin: string, env: Env): boolean {
  const allowed = env.CORS_ALLOWED_ORIGINS
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(origin.toLowerCase());
}

// ── handleCors ────────────────────────────────────────────────────────────────
// Call this at the top of every route handler before any logic runs.
//
// Returns either:
//   - A preflight Response (OPTIONS) — return it immediately to the client
//   - null — origin is valid, continue to route logic
//   - A 401 Response — origin is not allowed, return it immediately
//
// Usage in a route:
//   const corsResult = handleCors(request, env);
//   if (corsResult) return corsResult;

export function handleCors(request: Request, env: Env): Response | null {
  const origin = request.headers.get("Origin") ?? "";

  // No origin header — likely a same-origin or server-to-server request.
  // Allow it through; CORS only applies to cross-origin browser requests.
  if (!origin) return null;

  if (!isAllowedOrigin(origin, env)) {
    return errorResponse(HTTP.UNAUTHORIZED, "Origin not allowed");
  }

  // Preflight request — respond immediately with CORS headers, no body
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    });
  }

  // Origin is valid, not a preflight — caller continues to route logic
  return null;
}

// ── attachCors ────────────────────────────────────────────────────────────────
// Adds CORS headers to an existing Response before returning it to the client.
// Call this on every response that exits a route handler.
//
// Usage:
//   return attachCors(request, env, new Response(JSON.stringify(data)));

export function attachCors(
  request: Request,
  env: Env,
  response: Response
): Response {
  const origin = request.headers.get("Origin") ?? "";

  // No origin — no CORS headers needed
  if (!origin || !isAllowedOrigin(origin, env)) return response;

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(origin);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });
}