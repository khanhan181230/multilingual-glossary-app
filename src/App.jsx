import { useState, useMemo } from "react";

// ── Strict TypeScript-style types (JSDoc for runtime JSX) ──────────────────

/**
 * @typedef {'it-japanese' | 'advanced-chinese' | 'business-english'} TabId
 */

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} id
 * @property {string} term
 * @property {string} translation_en - English Translation
 * @property {string} translation_vi - Vietnamese Translation
 * @property {string} reading        - romaji / pinyin / pronunciation
 * @property {string} definition
 * @property {string} example
 * @property {string[]} tags
 */

/**
 * @typedef {Object} Tab
 * @property {TabId} id
 * @property {string} label
 * @property {string} sublabel
 * @property {string} accent
 * @property {string} accentBg
 * @property {string} accentText
 */

// ── Mock data ──────────────────────────────────────────────────────────────

/** @type {Record<TabId, GlossaryEntry[]>} */
const INITIAL_DATA = {
  "it-japanese": [
    { id: "itj1", term: "サーバー", reading: "sābā", definition: "A computer or program that provides services to other computers on a network.", example: "このサーバーは24時間稼働しています。", tags: ["infrastructure"], translation_en: "Server", translation_vi: "Máy chủ", translation_zh: "服务器" },
    { id: "itj2", term: "データベース", reading: "dētabēsu", definition: "An organized collection of structured information stored electronically.", example: "データベースを最適化する必要があります。", tags: ["data"], translation_en: "Database", translation_vi: "Cơ sở dữ liệu", translation_zh: "数据库" }
  ],
  "advanced-chinese": [
    { id: "zha1", term: "算法", reading: "suànfǎ", definition: "A set of rules or steps for solving a problem or accomplishing a task.", example: "这个排序算法的时间复杂度是O(n log n)。", tags: ["programming"], translation_en: "Algorithm", translation_vi: "Thuật toán", translation_ja: "アルゴリズム (arugorizu mu)" },
    { id: "zha2", term: "架构", reading: "jiàgòu", definition: "The high-level structure and organization of a software system.", example: "微服务架构提高了系统的可扩展性。", tags: ["design"], translation_en: "Architecture", translation_vi: "Kiến trúc hệ thống", translation_ja: "アーキテクチャ (ākitekucha)" }
  ],
  "business-english": [
    { id: "biz1", term: "ROI", reading: "är-oh-eye", definition: "A measure of the profitability of an investment relative to its cost.", example: "The campaign delivered a 340% ROI within Q3.", tags: ["finance"], translation_en: "Return on Investment", translation_vi: "Tỷ suất hoàn vốn", translation_zh: "投资回报率", translation_ja: "投資利益率" },
    { id: "biz2", term: "KPI", reading: "kay-pee-eye", definition: "A quantifiable metric used to evaluate success toward a defined objective.", example: "Monthly active users is our primary KPI this quarter.", tags: ["metrics"], translation_en: "Key Performance Indicator", translation_vi: "Chỉ số đánh giá hiệu suất", translation_zh: "关键绩效指标", translation_ja: "重要業績評価指標" }
  ],
};

/** @type {Tab[]} */
const TABS = [
  { id: "it-japanese",        label: "IT Japanese",       sublabel: "ITジャパニーズ", accent: "#E07B4F", accentBg: "rgba(224,123,79,0.10)", accentText: "#C05A2C" },
  { id: "advanced-chinese",   label: "Advanced Chinese",  sublabel: "高级中文",        accent: "#C0392B", accentBg: "rgba(192,57,43,0.09)",  accentText: "#9B2D20" },
  { id: "business-english",   label: "Business English",  sublabel: "Terminology",     accent: "#2471A3", accentBg: "rgba(36,113,163,0.10)", accentText: "#1A5276" },
];

const TAG_COLORS = {
  infrastructure: "#4A7FA5", network: "#3D8B74", data: "#7B68AA", storage: "#6B8E5E",
  security: "#C0392B", design: "#D4854A", ux: "#C9A227", cloud: "#2E86C1",
  programming: "#7D3C98", cs: "#6C5B7B", systems: "#4A6741", performance: "#A04000",
  devops: "#1A5276", finance: "#1E8449", metrics: "#7E5109", strategy: "#2E4057",
  management: "#4A235A", communication: "#1B4332", legal: "#7B3F00",
};

// ── Components ─────────────────────────────────────────────────────────────

/** @param {{ tag: string }} props */
function Tag({ tag }) {
  const color = TAG_COLORS[tag] || "#555";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase", padding: "2px 7px",
      borderRadius: 4, border: `1px solid ${color}22`,
      background: `${color}14`, color,
    }}>{tag}</span>
  );
}

/** @param {{ entry: GlossaryEntry, accent: string, accentBg: string, activeTab: TabId }} props */
function GlossaryCard({ entry, accent, accentBg, activeTab }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: "#fff", borderRadius: 10,
        border: "1px solid #E8E4DF",
        padding: "16px 20px", cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        boxShadow: expanded ? "0 4px 20px rgba(0,0,0,0.07)" : "none",
        borderColor: expanded ? accent : "#E8E4DF",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          {/* Main Term Row */}
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, fontFamily: "'Noto Serif', Georgia, serif", fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              {entry.term}
            </span>
            
            {/* If Business English, put the acronym definition inline inside parentheses */}
            {activeTab === "business-english" && entry.translation_en && (
              <span style={{ fontSize: 15, color: "#4A5568", fontWeight: 600, marginLeft: 8 }}>
                ({entry.translation_en})
              </span>
            )}
            
            <span style={{ fontSize: 13, color: "#888", marginLeft: 10, fontStyle: "italic" }}>
              {entry.reading}
            </span>
          </div>
          
          {/* Sub-languages Grid Breakdown */}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3, fontSize: 13 }}>
            
            {/* 1. Show English (Unless we are on the English Tab) */}
            {activeTab !== "business-english" && entry.translation_en && (
              <div style={{ color: "#4A5568", fontWeight: 500 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>EN:</span>
                {entry.translation_en}
              </div>
            )}

            {/* 2. Show Vietnamese */}
            {entry.translation_vi && (
              <div style={{ color: "#4A5568", fontWeight: 500 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>VN:</span>
                {entry.translation_vi}
              </div>
            )}

            {/* 3. Show Chinese (For Japanese and English Tabs) */}
            {activeTab !== "advanced-chinese" && entry.translation_zh && (
              <div style={{ color: "#4A5568", fontWeight: 500 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>ZH:</span>
                {entry.translation_zh}
              </div>
            )}

            {/* 4. Show Japanese (For Chinese and English Tabs) */}
            {activeTab !== "it-japanese" && entry.translation_ja && (
              <div style={{ color: "#4A5568", fontWeight: 500 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>JA:</span>
                {entry.translation_ja}
              </div>
            )}

          </div>
        </div>
        
        <span style={{
          fontSize: 11, fontWeight: 600, color: accent,
          background: accentBg, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap",
        }}>{entry.tags[0] || "General"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid #F0ECE8", paddingTop: 14 }}>
          <p style={{ fontSize: 14, color: "#444", lineHeight: 1.65, margin: "0 0 10px" }}>{entry.definition}</p>
          <div style={{ background: "#F9F6F3", borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Example</span>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.6 }}>{entry.example}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {entry.tags.map(t => <Tag key={t} tag={t} />)}
          </div>
        </div>
      )}

      <div style={{ textAlign: "right", marginTop: expanded ? 10 : 6 }}>
        <span style={{ fontSize: 11, color: "#bbb" }}>{expanded ? "▲ collapse" : "▼ expand"}</span>
      </div>
    </div>
  );
}

// ── Add Word Modal ─────────────────────────────────────────────────────────

/** @param {{ tab: Tab, onAdd: (e: GlossaryEntry) => void, onClose: () => void }} props */
function AddWordModal({ tab, onAdd, onClose }) {
  const [form, setForm] = useState({ term: "", translation_en: "", translation_vi: "", reading: "", definition: "", example: "", tags: "" });
  const [errors, setErrors] = useState({});

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const submit = () => {
    const errs = {};
    if (!form.term.trim()) errs.term = "Term is required";
    if (!form.translation_en.trim()) errs.translation_en = "English translation is required";
    if (!form.translation_vi.trim()) errs.translation_vi = "Vietnamese translation is required";
    if (!form.definition.trim()) errs.definition = "Definition is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    /** @type {GlossaryEntry} */
    const entry = {
      id: `custom-${Date.now()}`,
      term: form.term.trim(),
      translation_en: form.translation_en.trim(),
      translation_vi: form.translation_vi.trim(),
      reading: form.reading.trim() || "—",
      definition: form.definition.trim(),
      example: form.example.trim() || "No example provided.",
      tags: form.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
    };
    onAdd(entry);
    onClose();
  };

  const field = (label, key, placeholder, required = false, multiline = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}{required && <span style={{ color: tab.accent }}> *</span>}
      </label>
      {multiline
        ? <textarea value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows={2}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 12px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        : <input value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 12px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, outline: "none" }} />
      }
      {errors[key] && <p style={{ fontSize: 12, color: "#e74c3c", margin: "4px 0 0" }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "24px 28px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>Add new word</h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#888" }}>to {tab.label}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa", padding: 4 }}>✕</button>
        </div>
        
        {field("Term", "term", "e.g. サーバー / 算法", true)}
        {field("English Translation", "translation_en", "e.g. Server", true)}
        {field("Vietnamese Translation", "translation_vi", "e.g. Máy chủ", true)}
        {field("Reading / Pronunciation", "reading", "e.g. sābā / suànfǎ")}
        {field("Definition", "definition", "What does this term mean?", true, true)}
        {field("Example sentence", "example", "Use the term in context...", false, true)}
        {field("Tags", "tags", "e.g. network, security (comma-separated)")}
        
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={submit} style={{ flex: 1, background: tab.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Add word
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function GlossaryApp() {
  const [activeTab, setActiveTab] = useState(/** @type {TabId} */ ("it-japanese"));
  const [data, setData] = useState(INITIAL_DATA);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const tab = TABS.find(t => t.id === activeTab);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data[activeTab];
    return data[activeTab].filter(e =>
      e.term.toLowerCase().includes(q) ||
      e.translation_en.toLowerCase().includes(q) ||
      e.translation_vi.toLowerCase().includes(q) ||
      e.definition.toLowerCase().includes(q) ||
      e.tags.some(t => t.includes(q))
    );
  }, [data, activeTab, search]);

  /** @param {GlossaryEntry} entry */
  const handleAdd = (entry) => {
    setData(d => ({ ...d, [activeTab]: [entry, ...d[activeTab]] }));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4F1", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Serif+JP&family=Noto+Serif+SC&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#1C1C1E", padding: "32px 24px 0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#F5F0EA", letterSpacing: "-0.02em" }}>Lexicon</h1>
            <span style={{ fontSize: 13, color: "#777", fontWeight: 500 }}>Multilingual Glossary</span>
          </div>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888" }}>IT · Business · Language</p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); }}
                style={{
                  background: activeTab === t.id ? "#F7F4F1" : "transparent",
                  border: "none", cursor: "pointer",
                  padding: "10px 20px 12px", borderRadius: "8px 8px 0 0",
                  transition: "background 0.15s",
                }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeTab === t.id ? t.accent : "#666" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: activeTab === t.id ? "#888" : "#444", marginTop: 1 }}>{t.sublabel}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 48px" }}>

        {/* Search + Add */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#bbb" }}>⌕</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab?.label}…`}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 14px 10px 36px", fontSize: 14, borderRadius: 9,
                border: "1.5px solid #E0DBD5", background: "#fff", outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <button onClick={() => setShowModal(true)}
            style={{
              background: tab?.accent, color: "#fff", border: "none",
              borderRadius: 9, padding: "10px 18px", fontWeight: 700,
              fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
            }}>
            + Add word
          </button>
        </div>

        {/* Count */}
        <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 14px", fontWeight: 500 }}>
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          {search && ` for "${search}"`}
        </p>

        {/* Cards */}
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
              <div style={{ fontSize: 36 }}>∅</div>
              <p style={{ marginTop: 12, fontSize: 14 }}>No entries found for "{search}"</p>
            </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(entry => (
                <GlossaryCard key={entry.id} entry={entry} accent={tab?.accent} accentBg={tab?.accentBg} activeTab={activeTab} />
              ))}
            </div>
        }
      </div>

      {showModal && tab && (
        <AddWordModal tab={tab} onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}