// ── One-time seed script: Sheets → D1 ────────────────────────────────────────
// Run from your project root:
//   node seed-d1.mjs
//
// This script fetches all rows from your Apps Script endpoint and
// upserts them into D1 via the Worker sync endpoint.
// Only needed for the initial data load — after this, sync runs automatically.

const SCRIPT_URL  = "https://script.google.com/macros/s/AKfycbxO0vt5YtlKxNrf8-as2IfVK0365-sWbU9Nf28bn3COHdSZOnBgWtx5Vp40UX8xTS0/exec";
const SYNC_TOKEN  = "glossary_sync_2026_k9x$mP";
const WORKER_URL  = "https://glossary-worker.glossary-app.workers.dev";
const TABS        = ["it-japanese", "advanced-chinese", "business-english"];

// ── Temporarily bypass auth for initial seed ──────────────────────────────────
// We'll call D1 directly via wrangler instead of the Worker endpoint
// since Cloudflare Access JWT isn't set up yet.
// This uses the Wrangler D1 execute command to insert rows directly.

async function fetchSheetData() {
  console.log("📥 Fetching data from Google Sheets...");
  const res = await fetch(`${SCRIPT_URL}?token=${SYNC_TOKEN}`, {
  redirect: "follow",
});
  if (!res.ok) throw new Error(`Sheets fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

function rowToSQL(row) {
  const escape = (v) => v ? `'${String(v).replace(/'/g, "''")}'` : "NULL";
  return `INSERT INTO glossary (
    word_id, tab_id, term, reading,
    translation_en, translation_vi, translation_zh, translation_ja,
    definition, example, tags, detail, origin, created_at, updated_at
  ) VALUES (
    ${escape(row.id)}, ${escape(row.tab_id)}, ${escape(row.term)}, ${escape(row.reading)},
    ${escape(row.translation_en)}, ${escape(row.translation_vi)},
    ${escape(row.translation_zh)}, ${escape(row.translation_ja)},
    ${escape(row.definition)}, ${escape(row.example)},
    ${escape(row.tags)}, NULL, ${escape(row.origin || 'sheet')},
    datetime('now'), datetime('now')
  ) ON CONFLICT (word_id) DO UPDATE SET
    term           = excluded.term,
    reading        = excluded.reading,
    translation_en = excluded.translation_en,
    translation_vi = excluded.translation_vi,
    translation_zh = excluded.translation_zh,
    translation_ja = excluded.translation_ja,
    definition     = excluded.definition,
    example        = excluded.example,
    tags           = excluded.tags,
    origin         = excluded.origin,
    updated_at     = excluded.updated_at;`;
}

async function main() {
  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync } = await import("fs");

  const rows = await fetchSheetData();
  console.log(`✅ Fetched ${rows.length} rows from Sheets`);

  for (const tab of TABS) {
    const tabRows = rows.filter(r => r.tab_id === tab);
    if (tabRows.length === 0) {
      console.log(`⚠️  No rows for ${tab} — skipping`);
      continue;
    }

    console.log(`\n📤 Syncing ${tabRows.length} rows → ${tab}`);

    // Write SQL to a temp file
    const sql = tabRows.map(rowToSQL).join("\n");
    const tmpFile = `/tmp/seed_${tab.replace(/-/g, "_")}.sql`;
    writeFileSync(tmpFile, sql);

    try {
      execSync(
        `cd worker && npx wrangler d1 execute glossary-db --file=${tmpFile} --remote`,
        { stdio: "inherit" }
      );
      console.log(`✅ ${tab} synced`);
    } finally {
      unlinkSync(tmpFile);
    }
  }

  console.log("\n🎉 All tabs synced to D1. Reload your app to see the data.");
}

main().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
