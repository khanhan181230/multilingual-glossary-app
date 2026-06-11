-- ── Tags table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  tag         TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  color_hex   TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags (category);