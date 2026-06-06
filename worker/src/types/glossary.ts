// ── Tab identifiers ───────────────────────────────────────────────────────────

export type TabId =
  | "it-japanese"
  | "advanced-chinese"
  | "business-english";

export const VALID_TABS: TabId[] = [
  "it-japanese",
  "advanced-chinese",
  "business-english",
];

// ── Core glossary entry ───────────────────────────────────────────────────────

export interface GlossaryEntry {
  word_id:        string;
  tab_id:         TabId;
  term:           string;
  reading:        string | null;
  translation_en: string | null;
  translation_vi: string | null;
  translation_zh: string | null;
  translation_ja: string | null;
  definition:     string | null;
  example:        string | null;
  tags:           string | null;  // stored as comma-separated e.g. "data,storage"
  detail:         string | null;  // rich-text HTML
  origin:         "sheet" | "ui";
  created_at:     string;
  updated_at:     string;
}

// ── Payloads sent from the frontend ──────────────────────────────────────────

// POST /admin/words
export interface CreateWordPayload {
  tab_id:         TabId;
  term:           string;           // required
  reading?:       string;
  translation_en?: string;
  translation_vi?: string;
  translation_zh?: string;
  translation_ja?: string;
  definition:     string;           // required
  example?:       string;
  tags?:          string;           // comma-separated
  detail?:        string;
}

// PATCH /admin/words/:id
export interface UpdateWordPayload {
  term?:           string;
  reading?:        string;
  translation_en?: string;
  translation_vi?: string;
  translation_zh?: string;
  translation_ja?: string;
  definition?:     string;
  example?:        string;
  tags?:           string;
  detail?:         string;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface PaginatedResponse {
  data:        GlossaryEntry[];
  page:        number;
  page_size:   number;
  total:       number;
  total_pages: number;
}

export interface ErrorResponse {
  status:  number;
  message: string;
}

export interface SuccessResponse {
  success: true;
  word_id?: string;         // returned on INSERT
}

// ── Pagination query params ───────────────────────────────────────────────────

export interface PaginationParams {
  page:      number;   // 1-based
  page_size: number;   // clamped by Worker to MAX_PAGE_SIZE
  search?:   string;
}

export const MAX_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZE = 10;

// ── Sync & retry queue ────────────────────────────────────────────────────────

export type SyncOperation = "INSERT" | "UPDATE" | "DELETE";
export type SyncStatus    = "pending" | "dead";
export type SyncMethod    = "push" | "poll";

export interface PendingSyncEntry {
  id:          number;
  word_id:     string;
  tab_id:      TabId;
  operation:   SyncOperation;
  payload:     string | null;   // JSON-stringified GlossaryEntry; null for DELETE
  failed_at:   string;
  retry_count: number;
  status:      SyncStatus;
}

export interface SyncLogEntry {
  id:            number;
  last_synced_at: string;
  sync_method:   SyncMethod;
  tab_id:        TabId | null;
  rows_affected: number;
  status:        "success" | "failed";
  error_message: string | null;
}

// ── Cloudflare Worker environment bindings ────────────────────────────────────
// Matches the bindings declared in wrangler.toml

export interface Env {
  DB:                    D1Database;
  GLOSSARY_CACHE:        KVNamespace;
  CORS_ALLOWED_ORIGINS:  string;   // comma-separated list of allowed origins
  SHEETS_API_KEY?:       string;   // Google Sheets API key (set as secret)
  SHEETS_SPREADSHEET_ID?: string;  // The Glossary_Master_DB spreadsheet ID
  CF_ACCESS_CLIENT_ID?:  string;   // Cloudflare Access service token (optional)
}