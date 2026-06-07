import type {
  Env,
  TabId,
  CreateWordPayload,
  UpdateWordPayload,
} from "../types/glossary";
import { VALID_TABS } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
import { requireAuth } from "../middleware/auth";
import {
  insertWord,
  updateWord,
  deleteWord,
  queryWordById,
  generateWordId,
  logPendingSync,
} from "../db/queries";
import { invalidateTab } from "../cache/kv";
import { appendRow, updateRow, deleteRow } from "../services/sheets";

// ── Route dispatcher ──────────────────────────────────────────────────────────
// Matches:
//   POST   /admin/words          → createWord
//   PATCH  /admin/words/:id      → editWord
//   DELETE /admin/words/:id      → removeWord

export async function handleAdminRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    // ── CORS ─────────────────────────────────────────────────────────────────
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    // ── Auth — every admin route is protected ─────────────────────────────────
    await requireAuth(request, env);

    const url    = new URL(request.url);
    const parts  = url.pathname.split("/").filter(Boolean);
    // parts: ["admin", "words"] or ["admin", "words", ":id"]
    const wordId = parts[2] ?? null;

    switch (request.method) {
      case "POST":   return attachCors(request, env, await createWord(request, env));
      case "PATCH":  return attachCors(request, env, await editWord(request, env, wordId));
      case "DELETE": return attachCors(request, env, await removeWord(request, env, wordId));
      default:
        throw new AppError(HTTP.BAD_REQUEST, "Method not allowed");
    }
  });
}

// ── POST /admin/words ─────────────────────────────────────────────────────────

async function createWord(
  request: Request,
  env:     Env
): Promise<Response> {
  const body = await parseBody<CreateWordPayload>(request);

  // Validate required fields
  if (!body.tab_id || !VALID_TABS.includes(body.tab_id as TabId)) {
    throw new AppError(HTTP.BAD_REQUEST, `Invalid tab_id. Must be one of: ${VALID_TABS.join(", ")}`);
  }
  if (!body.term?.trim()) {
    throw new AppError(HTTP.BAD_REQUEST, "Field 'term' is required");
  }
  if (!body.definition?.trim()) {
    throw new AppError(HTTP.BAD_REQUEST, "Field 'definition' is required");
  }

  // 1. Generate word_id from D1 (D1 is source of truth for IDs)
  const word_id = await generateWordId(env, body.tab_id as TabId);

  // 2. INSERT into D1 first — fast, synchronous
  await insertWord(env, word_id, body);

  // 3. Invalidate KV cache for this tab
  await invalidateTab(env, body.tab_id as TabId);

  // 4. Async push to Google Sheets — wrapped in try/catch per guideline
  try {
    const entry = await queryWordById(env, word_id);
    await appendRow(env, body.tab_id as TabId, entry);
  } catch (err) {
    // Sheets write failed — log to pending_sheets_sync for retry
    console.error("[Sheets append failed]", err);
    const entry = await queryWordById(env, word_id);
    await logPendingSync(env, word_id, body.tab_id as TabId, "INSERT", entry);
  }

  return new Response(
    JSON.stringify({ success: true, word_id }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

// ── PATCH /admin/words/:id ────────────────────────────────────────────────────

async function editWord(
  request: Request,
  env:     Env,
  wordId:  string | null
): Promise<Response> {
  if (!wordId) {
    throw new AppError(HTTP.BAD_REQUEST, "Missing word_id in URL");
  }

  const body = await parseBody<UpdateWordPayload>(request);

  if (Object.keys(body).length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, "No fields provided to update");
  }

  // 1. Fetch existing entry first (throws 404 if not found)
  const existing = await queryWordById(env, wordId);

  // 2. UPDATE in D1
  await updateWord(env, wordId, body);

  // 3. Invalidate KV cache for this tab
  await invalidateTab(env, existing.tab_id);

  // 4. Async push updated row to Sheets
  try {
    const updated = await queryWordById(env, wordId);
    await updateRow(env, existing.tab_id, updated);
  } catch (err) {
    console.error("[Sheets update failed]", err);
    const updated = await queryWordById(env, wordId);
    await logPendingSync(env, wordId, existing.tab_id, "UPDATE", updated);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ── DELETE /admin/words/:id ───────────────────────────────────────────────────

async function removeWord(
  request: Request,
  env:     Env,
  wordId:  string | null
): Promise<Response> {
  if (!wordId) {
    throw new AppError(HTTP.BAD_REQUEST, "Missing word_id in URL");
  }

  // 1. Fetch existing entry (throws 404 if not found)
  const existing = await queryWordById(env, wordId);

  // 2. DELETE from D1
  await deleteWord(env, wordId);

  // 3. Invalidate KV cache
  await invalidateTab(env, existing.tab_id);

  // 4. Async delete from Sheets — scans column A by word_id, never by row index
  try {
    await deleteRow(env, existing.tab_id, wordId);
  } catch (err) {
    console.error("[Sheets delete failed]", err);
    // Payload is null for DELETE — the word_id is enough to replay
    await logPendingSync(env, wordId, existing.tab_id, "DELETE", null);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new AppError(HTTP.BAD_REQUEST, "Invalid JSON body");
  }
}