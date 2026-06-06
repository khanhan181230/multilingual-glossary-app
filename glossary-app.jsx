import { useState, useMemo, useRef, useEffect, useCallback } from "react";

/**
 * @typedef {'it-japanese' | 'advanced-chinese' | 'business-english'} TabId
 */

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} id
 * @property {string} term
 * @property {string} translation_en
 * @property {string} translation_vi
 * @property {string} [translation_zh]
 * @property {string} [translation_ja]
 * @property {string} reading
 * @property {string} definition
 * @property {string} example
 * @property {string[]} tags
 * @property {string} [detail]
 */

/**
 * @typedef {Object} Tab
 * @property {TabId} id
 * @property {string} label
 * @property {string} sublabel
 * @property {string} accent
 * @property {string} accentBg
 */

const PAGE_SIZE_OPTIONS = [5, 10, 20];

const INITIAL_DATA = {
  "it-japanese": [
    { id: "itj1", term: "サーバー", reading: "sābā", definition: "A computer or program that provides services to other computers on a network.", example: "このサーバーは24時間稼働しています。", tags: ["infrastructure"], translation_en: "Server", translation_vi: "Máy chủ", translation_zh: "服务器", detail: "<p>A <strong>server</strong> is a foundational concept in networking.</p><ul><li>Can be physical hardware or a virtual machine</li><li>Serves resources over a network to <em>clients</em></li></ul>" },
    { id: "itj2", term: "データベース", reading: "dētabēsu", definition: "An organized collection of structured information stored electronically.", example: "データベースを最適化する必要があります。", tags: ["data"], translation_en: "Database", translation_vi: "Cơ sở dữ liệu", translation_zh: "数据库", detail: "" },
    { id: "itj3", term: "クラウド", reading: "kuraudo", definition: "On-demand availability of computing resources delivered over the internet.", example: "クラウドに移行することでコストを削減できます。", tags: ["cloud"], translation_en: "Cloud", translation_vi: "Điện toán đám mây", translation_zh: "云计算", detail: "" },
    { id: "itj4", term: "セキュリティ", reading: "sekyuriti", definition: "Measures taken to protect a computer system from unauthorized access or attack.", example: "セキュリティパッチを適用してください。", tags: ["security"], translation_en: "Security", translation_vi: "Bảo mật", translation_zh: "安全", detail: "" },
    { id: "itj5", term: "バックアップ", reading: "bakkuappu", definition: "A copy of data stored separately to allow recovery from data loss.", example: "毎日バックアップを取ることが重要です。", tags: ["storage"], translation_en: "Backup", translation_vi: "Sao lưu", translation_zh: "备份", detail: "" },
    { id: "itj6", term: "インターフェース", reading: "intāfēsu", definition: "A shared boundary across which two or more components exchange information.", example: "ユーザーインターフェースを改善しました。", tags: ["design", "ux"], translation_en: "Interface", translation_vi: "Giao diện", translation_zh: "接口", detail: "" },
    { id: "itj7", term: "要件定義", reading: "yōken teigi", definition: "The process of defining and documenting what a system must do, agreed upon with the client before development begins.", example: "要件定義が曖昧だとプロジェクトが失敗しやすい。", tags: ["client-facing", "infrastructure"], translation_en: "Requirements Definition", translation_vi: "Định nghĩa yêu cầu", translation_zh: "需求定义", detail: "" },
  ],
  "advanced-chinese": [
    { id: "zha1", term: "算法", reading: "suànfǎ", definition: "A set of rules or steps for solving a problem or accomplishing a task.", example: "这个排序算法的时间复杂度是O(n log n)。", tags: ["programming"], translation_en: "Algorithm", translation_vi: "Thuật toán", translation_ja: "アルゴリズム", detail: "" },
    { id: "zha2", term: "架构", reading: "jiàgòu", definition: "The high-level structure and organization of a software system.", example: "微服务架构提高了系统的可扩展性。", tags: ["design"], translation_en: "Architecture", translation_vi: "Kiến trúc hệ thống", translation_ja: "アーキテクチャ", detail: "<p><strong>Software architecture</strong> defines the overall structure of a system.</p><ol><li>Monolithic — single deployable unit</li><li>Microservices — independent services</li><li>Serverless — event-driven functions</li></ol>" },
    { id: "zha3", term: "并发", reading: "bìngfā", definition: "The ability of a system to handle multiple tasks simultaneously.", example: "Go语言对并发编程有良好的支持。", tags: ["performance"], translation_en: "Concurrency", translation_vi: "Đồng thời", translation_ja: "並行処理", detail: "" },
    { id: "zha4", term: "部署", reading: "bùshǔ", definition: "The process of releasing and installing software into a production environment.", example: "我们使用CI/CD流水线自动化部署过程。", tags: ["devops"], translation_en: "Deployment", translation_vi: "Triển khai", translation_ja: "デプロイ", detail: "" },
    { id: "zha5", term: "缓存", reading: "huǎncún", definition: "Temporary storage for frequently accessed data to improve performance.", example: "Redis可以作为高性能缓存层使用。", tags: ["performance"], translation_en: "Cache", translation_vi: "Bộ nhớ đệm", translation_ja: "キャッシュ", detail: "" },
    { id: "zha6", term: "加密", reading: "jiāmì", definition: "The process of encoding data so that only authorized parties can access it.", example: "所有用户数据都经过AES-256加密存储。", tags: ["security"], translation_en: "Encryption", translation_vi: "Mã hóa", translation_ja: "暗号化", detail: "" },
    { id: "zha7", term: "接口", reading: "jiēkǒu", definition: "A defined set of methods or protocols enabling interaction between software components.", example: "RESTful接口设计使前后端分离成为可能。", tags: ["programming"], translation_en: "Interface / API", translation_vi: "Giao diện / API", translation_ja: "インターフェース", detail: "" },
  ],
  "business-english": [
    { id: "biz1", term: "ROI", reading: "är-oh-eye", definition: "A measure of the profitability of an investment relative to its cost.", example: "The campaign delivered a 340% ROI within Q3.", tags: ["finance"], translation_en: "Return on Investment", translation_vi: "Tỷ suất hoàn vốn", translation_zh: "投资回报率", translation_ja: "投資利益率", detail: "" },
    { id: "biz2", term: "KPI", reading: "kay-pee-eye", definition: "A quantifiable metric used to evaluate success toward a defined objective.", example: "Monthly active users is our primary KPI this quarter.", tags: ["metrics"], translation_en: "Key Performance Indicator", translation_vi: "Chỉ số hiệu suất", translation_zh: "关键绩效指标", translation_ja: "重要業績評価指標", detail: "<p><strong>KPIs</strong> are measurable values demonstrating how effectively objectives are being achieved.</p><ul><li><strong>Leading</strong> — predictive (pipeline value)</li><li><strong>Lagging</strong> — outcome (revenue)</li></ul>" },
    { id: "biz3", term: "Scalability", reading: "skay-luh-BIL-ih-tee", definition: "The capacity of a system to handle increased demand without compromising performance.", example: "The architecture was designed for horizontal scalability from day one.", tags: ["strategy"], translation_en: "Scalability", translation_vi: "Khả năng mở rộng", translation_zh: "可扩展性", translation_ja: "スケーラビリティ", detail: "" },
    { id: "biz4", term: "Stakeholder", reading: "STAYK-hohl-der", definition: "Any party with an interest in or affected by a project or organization.", example: "All stakeholders were aligned before the product launch.", tags: ["management"], translation_en: "Stakeholder", translation_vi: "Bên liên quan", translation_zh: "利益相关者", translation_ja: "利害関係者", detail: "" },
    { id: "biz5", term: "Due Diligence", reading: "dyoo DIL-ih-jens", definition: "A thorough investigation or audit conducted before a significant business decision.", example: "Two months of due diligence preceded the acquisition.", tags: ["legal"], translation_en: "Due Diligence", translation_vi: "Thẩm định", translation_zh: "尽职调查", translation_ja: "デューデリジェンス", detail: "" },
    { id: "biz6", term: "Bandwidth", reading: "BAND-width", definition: "In business: available capacity or resources a person or team can commit to work.", example: "We don't have the bandwidth to take on another project this sprint.", tags: ["management", "communication"], translation_en: "Bandwidth", translation_vi: "Năng lực xử lý", translation_zh: "带宽（能力）", translation_ja: "処理能力", detail: "" },
    { id: "biz7", term: "OKR", reading: "oh-kay-ar", definition: "A goal-setting framework using measurable results to track achievement of objectives.", example: "Our Q3 OKR is to increase user retention by 15%.", tags: ["strategy", "metrics"], translation_en: "Objectives & Key Results", translation_vi: "Mục tiêu & Kết quả then chốt", translation_zh: "目标与关键结果", translation_ja: "目標と主要結果", detail: "" },
  ],
};

const TABS = [
  { id: "it-japanese",      label: "IT Japanese",      sublabel: "ITジャパニーズ", accent: "#E07B4F", accentBg: "rgba(224,123,79,0.10)" },
  { id: "advanced-chinese", label: "Advanced Chinese", sublabel: "高级中文",       accent: "#C0392B", accentBg: "rgba(192,57,43,0.09)" },
  { id: "business-english", label: "Business English", sublabel: "Terminology",    accent: "#2471A3", accentBg: "rgba(36,113,163,0.10)" },
];

const TAG_COLORS = {
  infrastructure: "#4A7FA5", network: "#3D8B74", data: "#7B68AA", storage: "#6B8E5E",
  security: "#C0392B", design: "#D4854A", ux: "#C9A227", cloud: "#2E86C1",
  programming: "#7D3C98", cs: "#6C5B7B", systems: "#4A6741", performance: "#A04000",
  devops: "#1A5276", finance: "#1E8449", metrics: "#7E5109", strategy: "#2E4057",
  management: "#4A235A", communication: "#1B4332", legal: "#7B3F00",
  "client-facing": "#2E7D6B",
};

// ── Rich Text Toolbar ──────────────────────────────────────────────────────

function RichToolbar({ editorRef }) {
  const exec = (cmd) => { editorRef.current?.focus(); document.execCommand(cmd, false, null); };
  const btn = (label, cmd, extra = {}) => (
    <button onMouseDown={e => { e.preventDefault(); exec(cmd); }}
      style={{ background: "none", border: "1px solid #E0DBD5", borderRadius: 5, cursor: "pointer", padding: "4px 9px", fontSize: 13, color: "#444", lineHeight: 1.4, ...extra }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "8px 0 10px", borderBottom: "1px solid #F0ECE8", marginBottom: 10 }}>
      {btn("B", "bold", { fontWeight: 700 })}
      {btn("I", "italic", { fontStyle: "italic" })}
      {btn("U", "underline", { textDecoration: "underline" })}
      <div style={{ width: 1, background: "#E0DBD5", margin: "0 3px" }} />
      {btn("• List", "insertUnorderedList")}
      {btn("1. List", "insertOrderedList")}
      <div style={{ width: 1, background: "#E0DBD5", margin: "0 3px" }} />
      {btn("Clear", "removeFormat", { color: "#aaa" })}
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────

function DetailModal({ entry, accent, onClose, onSave }) {
  const [editing, setEditing] = useState(!entry.detail);
  const [draft, setDraft] = useState(entry.detail || "");
  const editorRef = useRef(null);

  useEffect(() => {
    if (editing && editorRef.current) {
      editorRef.current.innerHTML = draft;
      editorRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    const html = (editorRef.current?.innerHTML || "").trim();
    setDraft(html);
    onSave(entry.id, html);
    setEditing(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 580, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F0ECE8", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontFamily: "'Noto Serif', Georgia, serif", fontWeight: 700 }}>{entry.term}</span>
              <span style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>{entry.reading}</span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#aaa", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Detail notes</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ background: "#F5F2EF", border: "none", borderRadius: 7, cursor: "pointer", padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, color: "#666", fontSize: 13, fontWeight: 600 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#bbb", padding: "2px 4px" }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 20px" }}>
          {editing ? (
            <>
              <RichToolbar editorRef={editorRef} />
              <div ref={editorRef} contentEditable suppressContentEditableWarning
                style={{ minHeight: 200, outline: "none", fontSize: 14, color: "#333", lineHeight: 1.75, caretColor: accent }} />
              <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0ECE8" }}>
                <button onClick={handleSave} style={{ flex: 1, background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Save</button>
                <button onClick={() => entry.detail ? setEditing(false) : onClose()} style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: draft }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tag Chip ───────────────────────────────────────────────────────────────

function Tag({ tag }) {
  const color = TAG_COLORS[tag] || "#555";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, border: `1px solid ${color}22`, background: `${color}14`, color }}>
      {tag}
    </span>
  );
}

// ── Glossary Card ──────────────────────────────────────────────────────────

function GlossaryCard({ entry, accent, accentBg, activeTab, onDetailSave }) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const hasDetail = !!entry.detail?.trim();

  return (
    <>
      <div onClick={() => setExpanded(e => !e)}
        style={{ background: "#fff", borderRadius: 10, border: `1px solid ${expanded ? accent : "#E8E4DF"}`, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s", boxShadow: expanded ? "0 4px 20px rgba(0,0,0,0.07)" : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontFamily: "'Noto Serif', Georgia, serif", fontWeight: 700, color: "#1a1a1a" }}>{entry.term}</span>
              {activeTab === "business-english" && entry.translation_en && /^[A-Z0-9&]+$/.test(entry.term.replace(/\s/g, "")) && entry.term.length <= 6 && (
                <span style={{ fontSize: 15, color: "#4A5568", fontWeight: 600, marginLeft: 8 }}>({entry.translation_en})</span>
              )}
              <span style={{ fontSize: 13, color: "#888", marginLeft: 10, fontStyle: "italic" }}>{entry.reading}</span>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3, fontSize: 13 }}>
              {activeTab !== "business-english" && entry.translation_en && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>EN:</span>{entry.translation_en}
                </div>
              )}
              {entry.translation_vi && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>VN:</span>{entry.translation_vi}
                </div>
              )}
              {activeTab !== "advanced-chinese" && entry.translation_zh && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>ZH:</span>{entry.translation_zh}
                </div>
              )}
              {activeTab !== "it-japanese" && entry.translation_ja && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 8, display: "inline-block", width: 24 }}>JA:</span>{entry.translation_ja}
                </div>
              )}
            </div>
          </div>
          {/* Collapsed: show only first tag as badge */}
        <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: accentBg, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{entry.tags[0] || "General"}</span>
        </div>

        {expanded && (
          <div style={{ marginTop: 14, borderTop: "1px solid #F0ECE8", paddingTop: 14 }}>
            <p style={{ fontSize: 14, color: "#444", lineHeight: 1.65, margin: "0 0 10px" }}>{entry.definition}</p>
            <div style={{ background: "#F9F6F3", borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Example</span>
              <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.6 }}>{entry.example}</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {entry.tags.map(t => <Tag key={t} tag={t} />)}
            </div>
            <div style={{ borderTop: "1px solid #F0ECE8", paddingTop: 10 }}>
              {hasDetail ? (
                <button onClick={e => { e.stopPropagation(); setShowDetail(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600, color: accent, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  Detail →
                </button>
              ) : (
                <button onClick={e => { e.stopPropagation(); setShowDetail(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontStyle: "italic", textDecoration: "underline", textUnderlineOffset: 3, color: "#bbb" }}>
                  Want to add details? Click here
                </button>
              )}
            </div>
          </div>
        )}
        <div style={{ textAlign: "right", marginTop: expanded ? 10 : 6 }}>
          <span style={{ fontSize: 11, color: "#bbb" }}>{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
      </div>

      {showDetail && (
        <DetailModal entry={entry} accent={accent}
          onClose={() => setShowDetail(false)}
          onSave={(id, html) => { onDetailSave(id, html); setShowDetail(false); }} />
      )}
    </>
  );
}

// ── Pagination Bar ─────────────────────────────────────────────────────────

function PaginationBar({ currentPage, totalPages, accent, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    pages.push(
      <button key={i} onClick={() => onPageChange(i)}
        style={{
          width: 32, height: 32, borderRadius: 7, border: isActive ? `1.5px solid ${accent}` : "1.5px solid #E0DBD5",
          background: isActive ? accent : "#fff", color: isActive ? "#fff" : "#555",
          fontWeight: isActive ? 700 : 500, fontSize: 13, cursor: "pointer",
          transition: "all 0.15s",
        }}>
        {i}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 24 }}>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
        style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid #E0DBD5", background: "#fff", color: currentPage === 1 ? "#ccc" : "#555", fontSize: 14, cursor: currentPage === 1 ? "default" : "pointer" }}>
        ‹
      </button>
      {pages}
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
        style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid #E0DBD5", background: "#fff", color: currentPage === totalPages ? "#ccc" : "#555", fontSize: 14, cursor: currentPage === totalPages ? "default" : "pointer" }}>
        ›
      </button>
    </div>
  );
}

// ── Add Word Modal ─────────────────────────────────────────────────────────

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
    onAdd({ id: `custom-${Date.now()}`, term: form.term.trim(), translation_en: form.translation_en.trim(), translation_vi: form.translation_vi.trim(), reading: form.reading.trim() || "—", definition: form.definition.trim(), example: form.example.trim() || "No example provided.", tags: form.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean), detail: "" });
    onClose();
  };

  const field = (label, key, placeholder, required = false, multiline = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}{required && <span style={{ color: tab.accent }}> *</span>}
      </label>
      {multiline
        ? <textarea value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows={2} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 12px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        : <input value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 12px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, outline: "none" }} />
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
          <button onClick={submit} style={{ flex: 1, background: tab.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add word</button>
          <button onClick={onClose} style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function GlossaryApp() {
  const [activeTab, setActiveTab] = useState("it-japanese");
  const [data, setData] = useState(INITIAL_DATA);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  const tab = TABS.find(t => t.id === activeTab);

  // Reset to page 1 on tab / search / pageSize change
  useEffect(() => { setCurrentPage(1); }, [activeTab, search, pageSize]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data[activeTab];
    return data[activeTab].filter(e =>
      e.term.toLowerCase().includes(q) ||
      e.translation_en.toLowerCase().includes(q) ||
      (e.translation_vi && e.translation_vi.toLowerCase().includes(q)) ||
      e.definition.toLowerCase().includes(q) ||
      e.tags.some(t => t.includes(q))
    );
  }, [data, activeTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAdd = (entry) => {
    setData(d => ({ ...d, [activeTab]: [entry, ...d[activeTab]] }));
    setCurrentPage(1);
  };

  const handleDetailSave = useCallback((id, html) => {
    setData(d => ({ ...d, [activeTab]: d[activeTab].map(e => e.id === id ? { ...e, detail: html } : e) }));
  }, [activeTab]);

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
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); }}
                style={{ background: activeTab === t.id ? "#F7F4F1" : "transparent", border: "none", cursor: "pointer", padding: "10px 20px 12px", borderRadius: "8px 8px 0 0", transition: "background 0.15s" }}>
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
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#bbb" }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab?.label}…`}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 36px", fontSize: 14, borderRadius: 9, border: "1.5px solid #E0DBD5", background: "#fff", outline: "none", fontFamily: "inherit" }} />
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: tab?.accent, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            + Add word
          </button>
        </div>

        {/* Count row + page size selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "#aaa", margin: 0, fontWeight: 500 }}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {search && ` for "${search}"`}
            {totalPages > 1 && <span style={{ color: "#ccc" }}> · page {currentPage}/{totalPages}</span>}
          </p>

          {/* Page size selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              style={{
                fontSize: 12, fontWeight: 600, color: "#555",
                border: "1.5px solid #E0DBD5", borderRadius: 7,
                padding: "4px 26px 4px 10px", background: "#fff",
                cursor: "pointer", outline: "none",
                appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23aaa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
              <div style={{ fontSize: 36 }}>∅</div>
              <p style={{ marginTop: 12, fontSize: 14 }}>No entries found for "{search}"</p>
            </div>
          : <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {paginated.map(entry => (
                  <GlossaryCard key={entry.id} entry={entry}
                    accent={tab?.accent} accentBg={tab?.accentBg}
                    activeTab={activeTab} onDetailSave={handleDetailSave} />
                ))}
              </div>
              <PaginationBar currentPage={currentPage} totalPages={totalPages} accent={tab?.accent} onPageChange={setCurrentPage} />
            </>
        }
      </div>

      {showModal && tab && <AddWordModal tab={tab} onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  );
}
