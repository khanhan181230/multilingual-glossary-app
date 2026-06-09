import type { Env, TabId, GlossaryEntry } from "../types/glossary";
import { AppError, HTTP } from "../middleware/errorHandler";

// ── Apps Script proxy ─────────────────────────────────────────────────────────
// All Sheets writes go through the Apps Script web endpoint.
// This avoids OAuth entirely — the script runs as the sheet owner.
// Auth is via the shared SHEETS_SYNC_TOKEN secret.

async function callScript(
  env:  Env,
  body: object
): Promise<void> {
  if (!env.SHEETS_SCRIPT_URL) {
    throw new AppError(HTTP.SERVER_ERROR, "SHEETS_SCRIPT_URL secret is not set");
  }
  if (!env.SHEETS_SYNC_TOKEN) {
    throw new AppError(HTTP.SERVER_ERROR, "SHEETS_SYNC_TOKEN secret is not set");
  }

  const payload = { ...body, token: env.SHEETS_SYNC_TOKEN };

  // Apps Script requires following redirects
  const res = await fetch(env.SHEETS_SCRIPT_URL, {
    method:   "POST",
    redirect: "follow",
    headers:  { "Content-Type": "application/json" },
    body:     JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apps Script call failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { success?: boolean; error?: string };
  if (data.error) {
    throw new Error(`Apps Script error: ${data.error}`);
  }
}

// ── appendRow ─────────────────────────────────────────────────────────────────

export async function appendRow(
  env:   Env,
  tab:   TabId,
  entry: GlossaryEntry
): Promise<void> {
  await callScript(env, {
    operation: "INSERT",
    tab_id:    tab,
    entry:     entryToScriptShape(entry),
  });
}

// ── updateRow ─────────────────────────────────────────────────────────────────

export async function updateRow(
  env:   Env,
  tab:   TabId,
  entry: GlossaryEntry
): Promise<void> {
  await callScript(env, {
    operation: "UPDATE",
    tab_id:    tab,
    entry:     entryToScriptShape(entry),
  });
}

// ── deleteRow ─────────────────────────────────────────────────────────────────

export async function deleteRow(
  env:    Env,
  tab:    TabId,
  wordId: string
): Promise<void> {
  await callScript(env, {
    operation: "DELETE",
    tab_id:    tab,
    entry:     { word_id: wordId },
  });
}

// ── fetchAllRows ──────────────────────────────────────────────────────────────
// Used by the sync route for Sheets → D1 direction.
// Still uses the GET endpoint which works fine with API key.

export async function fetchAllRows(
  env: Env,
  tab: TabId
): Promise<GlossaryEntry[]> {
  if (!env.SHEETS_SCRIPT_URL || !env.SHEETS_SYNC_TOKEN) {
    throw new AppError(HTTP.SERVER_ERROR, "Sheets script credentials not configured");
  }

  const url = `${env.SHEETS_SCRIPT_URL}?token=${env.SHEETS_SYNC_TOKEN}`;
  const res = await fetch(url, { redirect: "follow" });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets fetchAllRows failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { data?: GlossaryEntry[] };
  const rows  = data.data ?? [];

  return rows.filter(r => r.tab_id === tab && r.word_id && r.term);
}

// ── Shape converter ───────────────────────────────────────────────────────────
// Maps GlossaryEntry to the shape Apps Script expects.
// word_id in D1 maps to "id" column in Sheets (column A).

function entryToScriptShape(entry: GlossaryEntry): Record<string, string> {
  return {
    word_id:        entry.word_id        ?? "",
    term:           entry.term           ?? "",
    reading:        entry.reading        ?? "",
    translation_en: entry.translation_en ?? "",
    translation_vi: entry.translation_vi ?? "",
    translation_zh: entry.translation_zh ?? "",
    translation_ja: entry.translation_ja ?? "",
    definition:     entry.definition     ?? "",
    example:        entry.example        ?? "",
    tags:           entry.tags           ?? "",
    origin:         entry.origin         ?? "ui",
    detail:         entry.detail         ?? "",
  };
}