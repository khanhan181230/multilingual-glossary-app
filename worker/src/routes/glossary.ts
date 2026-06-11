import type { Env, TabId } from "../types/glossary";
import { VALID_TABS, DEFAULT_PAGE_SIZE } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
import { queryGlossaryPage } from "../db/queries";
import { withCache } from "../cache/kv";

export async function handleGlossaryRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    const url     = new URL(request.url);
    const parts   = url.pathname.split("/").filter(Boolean);
    const tab_id  = parts[1] as TabId;

    if (!tab_id || !VALID_TABS.includes(tab_id)) {
      throw new AppError(HTTP.BAD_REQUEST, `Invalid tab. Must be one of: ${VALID_TABS.join(", ")}`);
    }

    const page      = Math.max(1, parseInt(url.searchParams.get("page")      ?? "1", 10));
    const page_size = Math.max(1, parseInt(url.searchParams.get("page_size") ?? String(DEFAULT_PAGE_SIZE), 10));
    const search    = url.searchParams.get("search") ?? undefined;

    const result = await withCache(
      env, tab_id, page, page_size, search,
      () => queryGlossaryPage(env, tab_id, page, page_size, search)
    );

    const trimmed = result.data.map((entry) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(entry)) {
        if (v !== null && v !== "") {
          out[k] = v;
        }
      }
      // Always include word_id — never strip the primary key
      out["word_id"] = entry.word_id;
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