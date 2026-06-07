import type { Env, TabId } from "../types/glossary";
import { VALID_TABS, DEFAULT_PAGE_SIZE } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
import { queryGlossaryPage } from "../db/queries";
import { withCache } from "../cache/kv";

// ── GET /glossary/:tab ────────────────────────────────────────────────────────
// Public route — no auth required.
// Query params:
//   ?page=1          (default: 1)
//   ?page_size=10    (default: 10, max: 20 — enforced in queries.ts)
//   ?search=keyword  (optional)

export async function handleGlossaryRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    // ── CORS ────────────────────────────────────────────────────────────────
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    // ── Parse tab from URL path ──────────────────────────────────────────────
    // Expected: /glossary/it-japanese, /glossary/advanced-chinese, etc.
    const url     = new URL(request.url);
    const parts   = url.pathname.split("/").filter(Boolean);
    const tab_id  = parts[1] as TabId; // parts[0] = "glossary"

    if (!tab_id || !VALID_TABS.includes(tab_id)) {
      throw new AppError(
        HTTP.BAD_REQUEST,
        `Invalid tab. Must be one of: ${VALID_TABS.join(", ")}`
      );
    }

    // ── Parse query params ───────────────────────────────────────────────────
    const page      = Math.max(1, parseInt(url.searchParams.get("page")      ?? "1",  10));
    const page_size = Math.max(1, parseInt(url.searchParams.get("page_size") ?? String(DEFAULT_PAGE_SIZE), 10));
    const search    = url.searchParams.get("search") ?? undefined;

    // ── Fetch — KV cache first, D1 fallback ─────────────────────────────────
    const result = await withCache(
      env,
      tab_id,
      page,
      page_size,
      search,
      () => queryGlossaryPage(env, tab_id, page, page_size, search)
    );

    // ── Serialize — strip null/empty fields from each entry ──────────────────
    // Null-trimmer: Worker strips empty keys so browser receives minimum payload
    const trimmed = result.data.map((entry) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(entry)) {
        // Only strip null and empty string — preserve 0 and false
        if (v !== null && v !== "") {
          out[k] = v;
        }
      }
      return out;
    });

    const payload = JSON.stringify({ ...result, data: trimmed });

    return attachCors(
      request,
      env,
      new Response(payload, {
        status:  200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
}