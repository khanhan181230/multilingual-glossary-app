import type {
  Env,
  GlossaryEntry,
  TabId,
  CreateWordPayload,
  UpdateWordPayload,
  PaginatedResponse,
  PendingSyncEntry,
  SyncOperation,
  MAX_PAGE_SIZE,
  TagEntry,
} from "../types/glossary";
import { MAX_PAGE_SIZE as PAGE_CAP, DEFAULT_PAGE_SIZE } from "../types/glossary";
import { AppError, HTTP } from "../middleware/errorHandler";

// ── Pagination ────────────────────────────────────────────────────────────────

export async function queryGlossaryPage(
  env: Env,
  tab_id: TabId,
  page: number,
  requestedSize: number,
  search?: string
): Promise<PaginatedResponse> {
  // Clamp page size — client can request but Worker enforces the cap
  const page_size = Math.min(Math.max(1, requestedSize), PAGE_CAP);
  const offset    = (Math.max(1, page) - 1) * page_size;

  let countQuery: string;
  let dataQuery:  string;
  let params:     (string | number)[];

  if (search && search.trim()) {
    // Search across term, definition, and tags using indexed columns
    const q = `%${search.trim()}%`;
    countQuery = `
      SELECT COUNT(*) as total
      FROM glossary
      WHERE tab_id = ?
        AND (term LIKE ? OR definition LIKE ? OR tags LIKE ?)
    `;
    dataQuery = `
      SELECT *
      FROM glossary
      WHERE tab_id = ?
        AND (term LIKE ? OR definition LIKE ? OR tags LIKE ?)
      ORDER BY word_id ASC
      LIMIT ? OFFSET ?
    `;
    params = [tab_id, q, q, q];
  } else {
    countQuery = `
      SELECT COUNT(*) as total
      FROM glossary
      WHERE tab_id = ?
    `;
    dataQuery = `
      SELECT *
      FROM glossary
      WHERE tab_id = ?
      ORDER BY word_id ASC
      LIMIT ? OFFSET ?
    `;
    params = [tab_id];
  }

  // Run count and data fetch in parallel
  const [countResult, dataResult] = await Promise.all([
    env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
    env.DB.prepare(dataQuery).bind(...params, page_size, offset).all<GlossaryEntry>(),
  ]);

  const total       = countResult?.total ?? 0;
  const total_pages = Math.max(1, Math.ceil(total / page_size));

  return {
    data:        dataResult.results ?? [],
    page:        Math.max(1, page),
    page_size,
    total,
    total_pages,
  };
}

// ── Single entry lookup ───────────────────────────────────────────────────────

export async function queryWordById(
  env: Env,
  word_id: string
): Promise<GlossaryEntry> {
  const row = await env.DB
    .prepare("SELECT * FROM glossary WHERE word_id = ?")
    .bind(word_id)
    .first<GlossaryEntry>();

  if (!row) {
    throw new AppError(HTTP.NOT_FOUND, "Word not found");
  }

  return row;
}

// ── INSERT ────────────────────────────────────────────────────────────────────

export async function insertWord(
  env: Env,
  word_id: string,
  payload: CreateWordPayload
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO glossary (
      word_id, tab_id, term, reading,
      translation_en, translation_vi, translation_zh, translation_ja,
      definition, example, tags, detail,
      origin, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      'ui', ?, ?
    )
  `).bind(
    word_id,
    payload.tab_id,
    payload.term,
    payload.reading        ?? null,
    payload.translation_en ?? null,
    payload.translation_vi ?? null,
    payload.translation_zh ?? null,
    payload.translation_ja ?? null,
    payload.definition,
    payload.example        ?? null,
    payload.tags           ?? null,
    payload.detail         ?? null,
    now,
    now
  ).run();
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
// Only updates fields that are explicitly provided in the payload.
// Fields not included in the payload are left unchanged in D1.

export async function updateWord(
  env: Env,
  word_id: string,
  payload: UpdateWordPayload
): Promise<void> {
  // Verify the word exists first
  await queryWordById(env, word_id);

  const now     = new Date().toISOString();
  const fields  = Object.keys(payload) as (keyof UpdateWordPayload)[];

  if (fields.length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, "No fields provided to update");
  }

  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values     = fields.map((f) => payload[f] ?? null);

  await env.DB.prepare(`
    UPDATE glossary
    SET ${setClauses}, updated_at = ?
    WHERE word_id = ?
  `).bind(...values, now, word_id).run();
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteWord(
  env: Env,
  word_id: string
): Promise<void> {
  // Verify the word exists first — throws 404 if not
  await queryWordById(env, word_id);

  await env.DB
    .prepare("DELETE FROM glossary WHERE word_id = ?")
    .bind(word_id)
    .run();
}

// ── Generate word_id ──────────────────────────────────────────────────────────
// D1 is the source of truth for word_id generation.
// Finds the highest existing numeric suffix for a tab prefix and increments it.
// e.g. if itj23 is the highest, next ID is itj24.

export async function generateWordId(
  env: Env,
  tab_id: TabId
): Promise<string> {
  const prefixMap: Record<TabId, string> = {
    "it-japanese":      "itj",
    "advanced-chinese": "zha",
    "business-english": "biz",
  };

  const prefix = prefixMap[tab_id];

  // Fetch all IDs for this tab to find the highest number
  const result = await env.DB
    .prepare("SELECT word_id FROM glossary WHERE tab_id = ?")
    .bind(tab_id)
    .all<{ word_id: string }>();

  const ids   = result.results ?? [];
  let   maxN  = 0;

  for (const row of ids) {
    const match = row.word_id.match(/\d+$/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxN) maxN = n;
    }
  }

  return `${prefix}${maxN + 1}`;
}

// ── Pending sync queue ────────────────────────────────────────────────────────

export async function logPendingSync(
  env: Env,
  word_id:   string,
  tab_id:    TabId,
  operation: SyncOperation,
  payload:   GlossaryEntry | null
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO pending_sheets_sync
      (word_id, tab_id, operation, payload, failed_at, retry_count, status)
    VALUES (?, ?, ?, ?, ?, 0, 'pending')
  `).bind(
    word_id,
    tab_id,
    operation,
    payload ? JSON.stringify(payload) : null,
    now
  ).run();
}

export async function getPendingSyncEntries(
  env: Env
): Promise<PendingSyncEntry[]> {
  const result = await env.DB
    .prepare(`
      SELECT * FROM pending_sheets_sync
      WHERE status = 'pending'
      ORDER BY id ASC
    `)
    .all<PendingSyncEntry>();

  return result.results ?? [];
}

export async function incrementSyncRetry(
  env: Env,
  id:          number,
  maxRetries:  number = 5
): Promise<void> {
  // If retry_count is already at the limit, mark as dead
  await env.DB.prepare(`
    UPDATE pending_sheets_sync
    SET
      retry_count = retry_count + 1,
      status = CASE WHEN retry_count + 1 >= ? THEN 'dead' ELSE 'pending' END
    WHERE id = ?
  `).bind(maxRetries, id).run();
}

export async function deletePendingSyncEntry(
  env: Env,
  id: number
): Promise<void> {
  await env.DB
    .prepare("DELETE FROM pending_sheets_sync WHERE id = ?")
    .bind(id)
    .run();
}

// ── Sync log ──────────────────────────────────────────────────────────────────

export async function logSync(
  env: Env,
  sync_method:   "push" | "poll",
  tab_id:        TabId | null,
  rows_affected: number,
  status:        "success" | "failed",
  error_message: string | null = null
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO sync_log
      (last_synced_at, sync_method, tab_id, rows_affected, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(now, sync_method, tab_id, rows_affected, status, error_message).run();
}


// ── Tag queries ────────────────────────────────────────────────────────────────

export async function queryAllTags(env: Env): Promise<TagEntry[]> {
  const result = await env.DB
    .prepare("SELECT * FROM tags ORDER BY category ASC, tag ASC")
    .all<TagEntry>();
  return result.results ?? [];
}

export async function upsertTags(
  env:  Env,
  tags: TagEntry[]
): Promise<void> {
  if (tags.length === 0) return;
  const statements = tags.map(t =>
    env.DB.prepare(`
      INSERT INTO tags (tag, category, color_hex, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (tag) DO UPDATE SET
        category    = excluded.category,
        color_hex   = excluded.color_hex,
        description = excluded.description
    `).bind(t.tag, t.category, t.color_hex, t.description ?? null)
  );
  await env.DB.batch(statements);
}