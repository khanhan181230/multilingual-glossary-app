// ── One-time seed script: Sheets → D1 ────────────────────────────────────────
// Run from your project root:
//   node seed-d1.mjs
//
// This script fetches all rows from your Apps Script endpoint and
// upserts them into D1 via the Worker sync endpoint.
// Only needed for the initial data load — after this, sync runs automatically.
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
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


// ── Seed tags ─────────────────────────────────────────────────────────────────
const TAGS = [
  ["infrastructure","Technical","#7B9EC2","Server, cloud, and system infrastructure topics"],
  ["network","Technical","#5BA08A","Networking, protocols, and connectivity"],
  ["data","Technical","#9B8EC4","Data storage, retrieval, and management"],
  ["storage","Technical","#7A9E6E","File systems, databases, and persistence layers"],
  ["security","Technical","#C47A7A","Authentication, encryption, and access control"],
  ["design","Technical","#C49A6A","Software and system design patterns"],
  ["ux","Technical","#C4A93A","User experience and interface design"],
  ["cloud","Technical","#5A9EC4","Cloud computing platforms and services"],
  ["programming","Technical","#9A6AC4","General programming and software development"],
  ["cs","Technical","#8A7A9B","Computer science fundamentals and theory"],
  ["systems","Technical","#6A8A5A","Systems architecture and engineering"],
  ["performance","Technical","#B46A3A","Optimisation, speed, and efficiency"],
  ["devops","Technical","#4A7AA6","Development operations and deployment practices"],
  ["client-facing","Process","#4A9A8A","Work and deliverables directly involving clients"],
  ["finance","Business","#5A9A6A","Financial metrics, modelling, and strategy"],
  ["metrics","Business","#9A7A3A","Measurement, KPIs, and performance tracking"],
  ["strategy","Business","#4A607A","Business strategy and planning"],
  ["management","Business","#6A4A7A","Team and project management"],
  ["communication","Business","#3A6A5A","Business communication and stakeholder relations"],
  ["legal","Business","#8A6A3A","Legal, compliance, and contractual topics"],
  ["product","Business","#7A5A4A","Product management and development lifecycle"],
];

console.log("\n📤 Seeding tags...");
const tagSQL = TAGS.map(([tag, category, color_hex, description]) =>
  `INSERT INTO tags (tag, category, color_hex, description) VALUES ('${tag}', '${category}', '${color_hex}', '${description}') ON CONFLICT (tag) DO UPDATE SET category=excluded.category, color_hex=excluded.color_hex, description=excluded.description;`
).join("\n");

const tagFile = "/tmp/seed_tags.sql";
writeFileSync(tagFile, tagSQL);
execSync(`cd worker && npx wrangler d1 execute glossary-db --file=${tagFile} --remote`, { stdio: "inherit" });
unlinkSync(tagFile);
console.log("✅ Tags seeded");