-- ── Glossary entries table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS glossary (
  word_id        TEXT    PRIMARY KEY,
  tab_id         TEXT    NOT NULL CHECK (tab_id IN ('it-japanese', 'advanced-chinese', 'business-english')),
  term           TEXT    NOT NULL,
  reading        TEXT,
  translation_en TEXT,
  translation_vi TEXT,
  translation_zh TEXT,
  translation_ja TEXT,
  definition     TEXT,
  example        TEXT,
  tags           TEXT,   -- comma-separated, e.g. "infrastructure,network"
  detail         TEXT,   -- rich-text HTML for the detail modal
  origin         TEXT    NOT NULL DEFAULT 'sheet' CHECK (origin IN ('sheet', 'ui')),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast tab queries with pagination
CREATE INDEX IF NOT EXISTS idx_glossary_tab
  ON glossary (tab_id, word_id);

-- Index for search queries on term
CREATE INDEX IF NOT EXISTS idx_glossary_term
  ON glossary (tab_id, term);

-- ── Sync log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  last_synced_at TEXT    NOT NULL DEFAULT (datetime('now')),
  sync_method    TEXT    NOT NULL CHECK (sync_method IN ('push', 'poll')),
  tab_id         TEXT,   -- null means all tabs synced
  rows_affected  INTEGER DEFAULT 0,
  status         TEXT    NOT NULL CHECK (status IN ('success', 'failed')),
  error_message  TEXT    -- null unless status = 'failed'
);

-- ── Pending Sheets sync queue ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_sheets_sync (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id     TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL CHECK (tab_id IN ('it-japanese', 'advanced-chinese', 'business-english')),
  operation   TEXT    NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload     TEXT,   -- JSON snapshot of the entry; null for DELETE
  failed_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dead'))
);

-- Index so retryQueue can efficiently pull pending entries in order
CREATE INDEX IF NOT EXISTS idx_pending_sync_status
  ON pending_sheets_sync (status, id);