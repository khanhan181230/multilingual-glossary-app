import type { Env } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
import { queryAllTags } from "../db/queries";

// ── GET /tags ─────────────────────────────────────────────────────────────────
// Public route — returns all tags with their colors and categories.
// Frontend uses this to replace the hardcoded TAG_COLORS object.

export async function handleTagsRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    if (request.method !== "GET") {
      throw new AppError(HTTP.BAD_REQUEST, "Method not allowed");
    }

    const tags = await queryAllTags(env);

    return attachCors(
      request,
      env,
      new Response(JSON.stringify({ data: tags }), {
        status:  200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
}