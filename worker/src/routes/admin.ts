import type {
  Env,
  TabId,
  CreateWordPayload,
  UpdateWordPayload,
} from "../types/glossary";
import { VALID_TABS } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
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

// ── Auth validator ────────────────────────────────────────────────────────────
// Supports two auth methods:
//   1. Cloudflare Access JWT  (CF-Access-JWT-Assertion header)
//   2. Service token          (CF-Access-Client-Id + CF-Access-Client-Secret)
//
// Method 2 is used by the Vercel frontend since browser-based JWT flow
// requires a redirect to the Access login page which breaks API calls.

async function validateAuth(request: Request, env: Env): Promise<void> {
  const clientId     = request.headers.get("CF-Access-Client-Id");
  const clientSecret = request.headers.get("CF-Access-Client-Secret");
  const jwt          = request.headers.get("CF-Access-JWT-Assertion");

  // ── Method 1: Service token ───────────────────────────────────────────────
  if (clientId && clientSecret) {
    const expectedId     = env.CF_ACCESS_CLIENT_ID;
    const expectedSecret = env.CF_ACCESS_CLIENT_SECRET;

    if (!expectedId || !expectedSecret) {
      throw new AppError(HTTP.SERVER_ERROR, "Service token secrets not configured");
    }

    if (clientId !== expectedId || clientSecret !== expectedSecret) {
      throw new AppError(HTTP.UNAUTHORIZED, "Invalid service token");
    }

    return; // Auth passed
  }

  // ── Method 2: Cloudflare Access JWT ──────────────────────────────────────
  if (jwt) {
    const { requireAuth } = await import("../middleware/auth");
    await requireAuth(request, env);
    return; // Auth passed
  }

  // ── Neither present ───────────────────────────────────────────────────────
  throw new AppError(HTTP.UNAUTHORIZED, "Missing authentication credentials");
}

// ── Route dispatcher ──────────────────────────────────────────────────────────

export async function handleAdminRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    // ── CORS ──────────────────────────────────────────────────────────────────
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    // ── Auth ──────────────────────────────────────────────────────────────────
    await validateAuth(request, env);

    const url    = new URL(request.url);
    const parts  = url.pathname.split("/").filter(Boolean);
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

  if (!body.tab_id || !VALID_TABS.includes(body.tab_id as TabId)) {
    throw new AppError(HTTP.BAD_REQUEST, `Invalid tab_id. Must be one of: ${VALID_TABS.join(", ")}`);
  }
  if (!body.term?.trim()) {
    throw new AppError(HTTP.BAD_REQUEST, "Field 'term' is required");
  }
  if (!body.definition?.trim()) {
    throw new AppError(HTTP.BAD_REQUEST, "Field 'definition' is required");
  }

  // 1. Generate word_id — D1 is source of truth for IDs
  const word_id = await generateWordId(env, body.tab_id as TabId);

  // 2. INSERT into D1 first
  await insertWord(env, word_id, body);

  // 3. Invalidate KV cache
  await invalidateTab(env, body.tab_id as TabId);

  // 4. Async push to Sheets — log to retry queue on failure
  try {
    const entry = await queryWordById(env, word_id);
    await appendRow(env, body.tab_id as TabId, entry);
  } catch (err) {
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

  // 1. Verify entry exists — throws 404 if not found
  const existing = await queryWordById(env, wordId);

  // 2. UPDATE in D1
  await updateWord(env, wordId, body);

  // 3. Invalidate KV cache
  await invalidateTab(env, existing.tab_id);

  // 4. Async push to Sheets
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

  // 1. Verify entry exists
  const existing = await queryWordById(env, wordId);

  // 2. DELETE from D1
  await deleteWord(env, wordId);

  // 3. Invalidate KV cache
  await invalidateTab(env, existing.tab_id);

  // 4. Async delete from Sheets — scans column A, never by row index
  try {
    await deleteRow(env, existing.tab_id, wordId);
  } catch (err) {
    console.error("[Sheets delete failed]", err);
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