import type { Env, TabId, GlossaryEntry } from "../types/glossary";
import { VALID_TABS } from "../types/glossary";
import { AppError, HTTP, withErrorHandler } from "../middleware/errorHandler";
import { handleCors, attachCors } from "../middleware/cors";
import { requireAuth } from "../middleware/auth";
import { invalidateTab } from "../cache/kv";
import { logSync } from "../db/queries";

// ── POST /sync ────────────────────────────────────────────────────────────────
// Private endpoint — called by Apps Script onChange trigger or Worker cron poll.
// Accepts a batch of glossary rows from Sheets and upserts them into D1.
// Auth required — this is the Sheets → D1 direction.
//
// Request body shape:
// {
//   tab_id: TabId,
//   rows:   GlossaryEntry[]
// }

export async function handleSyncRoute(
  request: Request,
  env:     Env
): Promise<Response> {
  return withErrorHandler(async () => {
    // ── CORS ─────────────────────────────────────────────────────────────────
    const corsResult = handleCors(request, env);
    if (corsResult) return corsResult;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const syncToken = request.headers.get("X-Sync-Token");
    const bodyToken = (await request.clone().json() as { token?: string }).token;

    if (syncToken !== env.SHEETS_SYNC_TOKEN && bodyToken !== env.SHEETS_SYNC_TOKEN) {
      await requireAuth(request, env);
    }

    if (request.method !== "POST") {
      throw new AppError(HTTP.BAD_REQUEST, "Method not allowed");
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { tab_id: TabId; rows: GlossaryEntry[] };
    try {
      body = await request.json();
    } catch {
      throw new AppError(HTTP.BAD_REQUEST, "Invalid JSON body");
    }

    const { tab_id, rows } = body;

    if (!tab_id || !VALID_TABS.includes(tab_id)) {
      throw new AppError(
        HTTP.BAD_REQUEST,
        `Invalid tab_id. Must be one of: ${VALID_TABS.join(", ")}`
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError(HTTP.BAD_REQUEST, "Field 'rows' must be a non-empty array");
    }

    // ── Upsert rows into D1 ───────────────────────────────────────────────────
    // Uses INSERT OR REPLACE so re-running the sync is always safe.
    // Sheets is source of truth — its data overwrites D1 on conflict.
    let rowsAffected = 0;

    try {
      const now = new Date().toISOString();

      // Batch upserts using D1 batch API for performance
      const statements = rows.map((row) =>
        env.DB.prepare(`
          INSERT INTO glossary (
            word_id, tab_id, term, reading,
            translation_en, translation_vi, translation_zh, translation_ja,
            definition, example, tags, detail,
            origin, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
          )
          ON CONFLICT (word_id) DO UPDATE SET
            term           = excluded.term,
            reading        = excluded.reading,
            translation_en = excluded.translation_en,
            translation_vi = excluded.translation_vi,
            translation_zh = excluded.translation_zh,
            translation_ja = excluded.translation_ja,
            definition     = excluded.definition,
            example        = excluded.example,
            tags           = excluded.tags,
            detail         = excluded.detail,
            origin         = excluded.origin,
            updated_at     = excluded.updated_at
        `).bind(
          row.word_id,
          tab_id,
          row.term          ?? null,
          row.reading        ?? null,
          row.translation_en ?? null,
          row.translation_vi ?? null,
          row.translation_zh ?? null,
          row.translation_ja ?? null,
          row.definition     ?? null,
          row.example        ?? null,
          row.tags           ?? null,
          row.detail         ?? null,
          row.origin         ?? "sheet",
          row.created_at     ?? now,
          now
        )
      );

      await env.DB.batch(statements);
      rowsAffected = rows.length;

      // ── Invalidate KV cache for this tab ──────────────────────────────────
      await invalidateTab(env, tab_id);

      // ── Log successful sync ───────────────────────────────────────────────
      await logSync(env, "push", tab_id, rowsAffected, "success");

    } catch (err) {
      // Log the failure then re-throw so withErrorHandler returns 500
      await logSync(env, "push", tab_id, 0, "failed",
        err instanceof Error ? err.message : "Unknown error"
      );
      throw err;
    }

    return attachCors(
      request,
      env,
      new Response(
        JSON.stringify({ success: true, rows_synced: rowsAffected }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  });
}