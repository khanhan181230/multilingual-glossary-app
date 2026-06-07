import type { Env, TabId, GlossaryEntry } from "../types/glossary";
import { AppError, HTTP } from "../middleware/errorHandler";

// ── Sheets API config ─────────────────────────────────────────────────────────
// Spreadsheet ID is stored as a Worker secret.
// Set it with: npx wrangler secret put SHEETS_SPREADSHEET_ID

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Maps each tab_id to its exact sheet name in Glossary_Master_DB
const SHEET_NAMES: Record<TabId, string> = {
  "it-japanese":      "it-japanese",
  "advanced-chinese": "advanced-chinese",
  "business-english": "business-english",
};

// Column order must match your Sheets layout exactly:
// A:id  B:term  C:reading  D:translation_en  E:translation_vi
// F:translation_zh  G:translation_ja  H:definition  I:example
// J:tags  K:origin  L:detail
const COLUMN_ORDER: (keyof GlossaryEntry)[] = [
  "word_id", "term", "reading",
  "translation_en", "translation_vi", "translation_zh", "translation_ja",
  "definition", "example", "tags", "origin", "detail",
];

// ── Auth header ───────────────────────────────────────────────────────────────

function authHeader(env: Env): HeadersInit {
  if (!env.SHEETS_API_KEY) {
    throw new AppError(HTTP.SERVER_ERROR, "SHEETS_API_KEY secret is not set");
  }
  return { "Content-Type": "application/json" };
}

function apiUrl(env: Env, path: string): string {
  if (!env.SHEETS_SPREADSHEET_ID) {
    throw new AppError(HTTP.SERVER_ERROR, "SHEETS_SPREADSHEET_ID secret is not set");
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${SHEETS_BASE}/${env.SHEETS_SPREADSHEET_ID}${path}${sep}key=${env.SHEETS_API_KEY}`;
}

// ── entryToRow ────────────────────────────────────────────────────────────────
// Converts a GlossaryEntry into an ordered array matching Sheets column layout.

function entryToRow(entry: GlossaryEntry): string[] {
  return COLUMN_ORDER.map((col) => {
    const val = entry[col];
    return val !== null && val !== undefined ? String(val) : "";
  });
}

// ── appendRow ─────────────────────────────────────────────────────────────────
// Appends a new row to the correct sheet tab.
// Called after a successful D1 INSERT.

export async function appendRow(
  env:   Env,
  tab:   TabId,
  entry: GlossaryEntry
): Promise<void> {
  const sheetName = SHEET_NAMES[tab];
  const range     = `${sheetName}!A:L`;
  const url       = apiUrl(env, `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`);

  const res = await fetch(url, {
    method:  "POST",
    headers: authHeader(env),
    body:    JSON.stringify({ values: [entryToRow(entry)] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets appendRow failed (${res.status}): ${err}`);
  }
}

// ── findRowIndex ──────────────────────────────────────────────────────────────
// Scans column A of the sheet to find the row number matching word_id.
// NEVER uses a hardcoded row index — safe against Sheets row shifting.
// Returns the 1-based row number, or null if not found.

async function findRowIndex(
  env:    Env,
  tab:    TabId,
  wordId: string
): Promise<number | null> {
  const sheetName = SHEET_NAMES[tab];
  const range     = `${sheetName}!A:A`;
  const url       = apiUrl(env, `/values/${encodeURIComponent(range)}`);

  const res = await fetch(url, { headers: authHeader(env) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets findRow failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { values?: string[][] };
  const rows  = data.values ?? [];

  // rows[0] is the header row — skip it (index 0 = row 1 in Sheets)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === wordId) {
      return i + 1; // Convert to 1-based Sheets row number
    }
  }

  return null; // Not found
}

// ── updateRow ─────────────────────────────────────────────────────────────────
// Finds the row by word_id in column A, then updates it in place.
// Called after a successful D1 UPDATE.

export async function updateRow(
  env:   Env,
  tab:   TabId,
  entry: GlossaryEntry
): Promise<void> {
  const rowIndex = await findRowIndex(env, tab, entry.word_id);

  if (rowIndex === null) {
    throw new Error(`Sheets updateRow: word_id "${entry.word_id}" not found in ${tab}`);
  }

  const sheetName = SHEET_NAMES[tab];
  const range     = `${sheetName}!A${rowIndex}:L${rowIndex}`;
  const url       = apiUrl(env, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`);

  const res = await fetch(url, {
    method:  "PUT",
    headers: authHeader(env),
    body:    JSON.stringify({ values: [entryToRow(entry)] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets updateRow failed (${res.status}): ${err}`);
  }
}

// ── deleteRow ─────────────────────────────────────────────────────────────────
// Finds the row by word_id in column A, then deletes it.
// Sheets automatically shifts rows up after deletion.
// Called after a successful D1 DELETE.

export async function deleteRow(
  env:    Env,
  tab:    TabId,
  wordId: string
): Promise<void> {
  if (!env.SHEETS_SPREADSHEET_ID) {
    throw new AppError(HTTP.SERVER_ERROR, "SHEETS_SPREADSHEET_ID secret is not set");
  }

  const rowIndex = await findRowIndex(env, tab, wordId);

  if (rowIndex === null) {
    throw new Error(`Sheets deleteRow: word_id "${wordId}" not found in ${tab}`);
  }

  // Sheets batchUpdate uses 0-based indices for deleteDimension
  // We also need the sheetId (numeric) not the sheet name
  const sheetId = await getSheetId(env, tab);
  const url     = apiUrl(env, `:batchUpdate`).replace(`?key=${env.SHEETS_API_KEY}`, "");
  const urlWithKey = `${SHEETS_BASE}/${env.SHEETS_SPREADSHEET_ID}:batchUpdate?key=${env.SHEETS_API_KEY}`;

  const res = await fetch(urlWithKey, {
    method:  "POST",
    headers: authHeader(env),
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId:    sheetId,
            dimension:  "ROWS",
            startIndex: rowIndex - 1, // Convert to 0-based
            endIndex:   rowIndex,     // Exclusive — deletes exactly one row
          },
        },
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets deleteRow failed (${res.status}): ${err}`);
  }
}

// ── getSheetId ────────────────────────────────────────────────────────────────
// Fetches the numeric sheetId for a given tab name.
// Required for the batchUpdate deleteDimension API.
// Result is not cached — called only during delete operations.

async function getSheetId(env: Env, tab: TabId): Promise<number> {
  const url = apiUrl(env, "?fields=sheets.properties");

  const res = await fetch(url, { headers: authHeader(env) });
  if (!res.ok) {
    throw new Error(`Sheets getSheetId failed (${res.status})`);
  }

  const data = await res.json() as {
    sheets: { properties: { sheetId: number; title: string } }[]
  };

  const sheetName = SHEET_NAMES[tab];
  const sheet     = data.sheets.find(
    (s) => s.properties.title === sheetName
  );

  if (!sheet) {
    throw new Error(`Sheet tab "${sheetName}" not found in spreadsheet`);
  }

  return sheet.properties.sheetId;
}

// ── fetchAllRows ──────────────────────────────────────────────────────────────
// Reads all rows from a sheet tab for the Sheets → D1 sync.
// Called by the sync route when processing a push or poll.

export async function fetchAllRows(
  env: Env,
  tab: TabId
): Promise<GlossaryEntry[]> {
  const sheetName = SHEET_NAMES[tab];
  const range     = `${sheetName}!A:L`;
  const url       = apiUrl(env, `/values/${encodeURIComponent(range)}`);

  const res = await fetch(url, { headers: authHeader(env) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets fetchAllRows failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { values?: string[][] };
  const rows  = data.values ?? [];

  if (rows.length <= 1) return []; // Empty or header-only

  // Skip header row (index 0), map remaining rows to GlossaryEntry shape
  return rows.slice(1).map((row) => ({
    word_id:        row[0]  ?? "",
    term:           row[1]  ?? "",
    reading:        row[2]  || null,
    translation_en: row[3]  || null,
    translation_vi: row[4]  || null,
    translation_zh: row[5]  || null,
    translation_ja: row[6]  || null,
    definition:     row[7]  || null,
    example:        row[8]  || null,
    tags:           row[9]  || null,
    origin:         (row[10] as "sheet" | "ui") || "sheet",
    detail:         row[11] || null,
    tab_id:         tab,
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  })).filter((e) => e.word_id && e.term); // Skip blank rows
}