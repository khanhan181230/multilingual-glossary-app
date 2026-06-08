import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  fetchGlossaryPage,
  createWord,
  updateWord,
  deleteWord,
} from "./api/glossary";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [5, 10, 20];

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
  "client-facing": "#2E7D6B", product: "#5D4037",
};

// ── Responsive styles helper ──────────────────────────────────────────────────

const isMobile = () => window.innerWidth < 480;

// ── Rich Text Toolbar ──────────────────────────────────────────────────────────

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

// ── Detail Modal ───────────────────────────────────────────────────────────────

function DetailModal({ entry, accent, onClose, onSave }) {
  const [editing, setEditing] = useState(!entry.detail);
  const [draft, setDraft] = useState(entry.detail || "");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (editing && editorRef.current) {
      editorRef.current.innerHTML = draft;
      editorRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    const html = (editorRef.current?.innerHTML || "").trim();
    setSaving(true);
    try {
      await onSave(entry.word_id, html);
      setDraft(html);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "90vw", maxWidth: 580, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F0ECE8", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontFamily: "'Noto Serif', Georgia, serif", fontWeight: 700 }}>{entry.term}</span>
              <span style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>{entry.reading}</span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#aaa", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Detail notes</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
          {editing ? (
            <>
              <RichToolbar editorRef={editorRef} />
              <div ref={editorRef} contentEditable suppressContentEditableWarning
                style={{ minHeight: 180, outline: "none", fontSize: 14, color: "#333", lineHeight: 1.75, caretColor: accent }} />
              <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0ECE8" }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 1, background: saving ? "#aaa" : accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => entry.detail ? setEditing(false) : onClose()}
                  style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
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

// ── Confirm Delete Modal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({ entry, accent, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "90vw", maxWidth: 420, padding: "28px 24px 20px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Delete this word?</h3>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#555" }}>
          <strong>"{entry.term}"</strong> will be permanently deleted from D1 and Google Sheets.
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#e74c3c", fontWeight: 500 }}>This action cannot be undone.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleConfirm} disabled={loading}
            style={{ flex: 1, background: loading ? "#aaa" : "#e74c3c", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer" }}>
            {loading ? "Deleting…" : "Yes, delete"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag Chip ───────────────────────────────────────────────────────────────────

function Tag({ tag }) {
  const color = TAG_COLORS[tag] || "#555";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, border: `1px solid ${color}22`, background: `${color}14`, color }}>
      {tag}
    </span>
  );
}

// ── Glossary Card ──────────────────────────────────────────────────────────────

function GlossaryCard({ entry, accent, accentBg, activeTab, onDetailSave, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const hasDetail = !!entry.detail?.trim();
  const tags = entry.tags ? entry.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const isAbbreviation = activeTab === "business-english" &&
    entry.translation_en &&
    /^[A-Z0-9&]+$/.test(entry.term.replace(/\s/g, "")) &&
    entry.term.length <= 6;

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${expanded ? accent : "#E8E4DF"}`, padding: "14px 16px", transition: "box-shadow 0.15s, border-color 0.15s", boxShadow: expanded ? "0 4px 20px rgba(0,0,0,0.07)" : "none" }}>

        {/* Top row — term + tag badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: 20, fontFamily: "'Noto Serif', Georgia, serif", fontWeight: 700, color: "#1a1a1a" }}>{entry.term}</span>
              {isAbbreviation && (
                <span style={{ fontSize: 13, color: "#4A5568", fontWeight: 600 }}>({entry.translation_en})</span>
              )}
              {entry.reading && (
                <span style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>{entry.reading}</span>
              )}
            </div>
            {/* Translations */}
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2, fontSize: 13 }}>
              {activeTab !== "business-english" && entry.translation_en && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 6, display: "inline-block", minWidth: 24 }}>EN:</span>{entry.translation_en}
                </div>
              )}
              {entry.translation_vi && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 6, display: "inline-block", minWidth: 24 }}>VN:</span>{entry.translation_vi}
                </div>
              )}
              {activeTab !== "advanced-chinese" && entry.translation_zh && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 6, display: "inline-block", minWidth: 24 }}>ZH:</span>{entry.translation_zh}
                </div>
              )}
              {activeTab !== "it-japanese" && entry.translation_ja && (
                <div style={{ color: "#4A5568", fontWeight: 500 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", marginRight: 6, display: "inline-block", minWidth: 24 }}>JA:</span>{entry.translation_ja}
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: accentBg, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
            {tags[0] || "general"}
          </span>
        </div>

        {/* Expanded zone */}
        {expanded && (
          <div style={{ marginTop: 14, borderTop: "1px solid #F0ECE8", paddingTop: 14 }}>
            {entry.definition && (
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.65, margin: "0 0 10px" }}>{entry.definition}</p>
            )}
            {entry.example && (
              <div style={{ background: "#F9F6F3", borderLeft: `3px solid ${accent}`, borderRadius: "0 6px 6px 0", padding: "8px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Example</span>
                <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.6 }}>{entry.example}</p>
              </div>
            )}

            {/* All tags */}
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {tags.map(t => <Tag key={t} tag={t} />)}
              </div>
            )}

            {/* Detail trigger */}
            <div style={{ borderTop: "1px solid #F0ECE8", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
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

              {/* Edit / Delete buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); onEdit(entry); }}
                  style={{ background: "#F5F2EF", border: "none", borderRadius: 7, cursor: "pointer", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#555" }}>
                  Edit
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(entry); }}
                  style={{ background: "#FEF2F2", border: "none", borderRadius: 7, cursor: "pointer", padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#e74c3c" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "right", marginTop: expanded ? 8 : 6, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize: 11, color: "#bbb" }}>{expanded ? "▲ collapse" : "▼ expand"}</span>
        </div>
      </div>

      {showDetail && (
        <DetailModal entry={entry} accent={accent}
          onClose={() => setShowDetail(false)}
          onSave={async (word_id, html) => {
            await onDetailSave(word_id, html);
            setShowDetail(false);
          }} />
      )}
    </>
  );
}

// ── Word Modal (Add + Edit) ────────────────────────────────────────────────────

function WordModal({ tab, entry, onSave, onClose }) {
  const isEdit = !!entry;
  const [form, setForm] = useState({
    term:           entry?.term           || "",
    translation_en: entry?.translation_en || "",
    translation_vi: entry?.translation_vi || "",
    translation_zh: entry?.translation_zh || "",
    translation_ja: entry?.translation_ja || "",
    reading:        entry?.reading        || "",
    definition:     entry?.definition     || "",
    example:        entry?.example        || "",
    tags:           entry?.tags           || "",
  });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const submit = async () => {
    const errs = {};
    if (!form.term.trim())       errs.term       = "Term is required";
    if (!form.definition.trim()) errs.definition = "Definition is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setApiError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, placeholder, required = false, multiline = false) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}{required && <span style={{ color: tab.accent }}> *</span>}
      </label>
      {multiline
        ? <textarea value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows={2}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
        : <input value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 10px", borderRadius: 7, border: `1px solid ${errors[key] ? "#e74c3c" : "#DDD"}`, outline: "none" }} />
      }
      {errors[key] && <p style={{ fontSize: 12, color: "#e74c3c", margin: "3px 0 0" }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "90vw", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>{isEdit ? "Edit word" : "Add new word"}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#888" }}>{tab.label}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa", padding: 4 }}>✕</button>
        </div>

        {apiError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: "#e74c3c" }}>
            {apiError}
          </div>
        )}

        {field("Term", "term", "e.g. サーバー / 算法 / ROI", true)}
        {field("English Translation", "translation_en", "e.g. Server")}
        {field("Vietnamese Translation", "translation_vi", "e.g. Máy chủ")}
        {field("Chinese Translation", "translation_zh", "e.g. 服务器")}
        {field("Japanese Translation", "translation_ja", "e.g. サーバー")}
        {field("Reading / Pronunciation", "reading", "e.g. sābā / suànfǎ")}
        {field("Definition", "definition", "What does this term mean?", true, true)}
        {field("Example sentence", "example", "Use the term in context...", false, true)}
        {field("Tags", "tags", "e.g. network,security (comma-separated)")}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, background: loading ? "#aaa" : tab.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer" }}>
            {loading ? "Saving…" : isEdit ? "Save changes" : "Add word"}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "#F5F2EF", color: "#555", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination Bar ─────────────────────────────────────────────────────────────

function PaginationBar({ currentPage, totalPages, accent, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 24, flexWrap: "wrap" }}>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
        style={{ width: 36, height: 36, borderRadius: 7, border: "1.5px solid #E0DBD5", background: "#fff", color: currentPage === 1 ? "#ccc" : "#555", fontSize: 16, cursor: currentPage === 1 ? "default" : "pointer" }}>
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          style={{ width: 36, height: 36, borderRadius: 7, border: `1.5px solid ${p === currentPage ? accent : "#E0DBD5"}`, background: p === currentPage ? accent : "#fff", color: p === currentPage ? "#fff" : "#555", fontWeight: p === currentPage ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
          {p}
        </button>
      ))}
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
        style={{ width: 36, height: 36, borderRadius: 7, border: "1.5px solid #E0DBD5", background: "#fff", color: currentPage === totalPages ? "#ccc" : "#555", fontSize: 16, cursor: currentPage === totalPages ? "default" : "pointer" }}>
        ›
      </button>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function GlossaryApp() {
  const [activeTab, setActiveTab]     = useState("it-japanese");
  const [entries, setEntries]         = useState([]);
  const [pagination, setPagination]   = useState({ page: 1, page_size: 5, total: 0, total_pages: 1 });
  const [search, setSearch]           = useState("");
  const [pageSize, setPageSize]       = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editEntry, setEditEntry]     = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const tab = TABS.find(t => t.id === activeTab);

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const loadPage = useCallback(async (tabId, page, size, q) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchGlossaryPage(tabId, page, size, q);
      setEntries(res.data);
      setPagination({ page: res.page, page_size: res.page_size, total: res.total, total_pages: res.total_pages });
    } catch (err) {
      setError(err.message || "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when tab / page / pageSize / search changes
  useEffect(() => {
    loadPage(activeTab, currentPage, pageSize, search);
  }, [activeTab, currentPage, pageSize, search, loadPage]);

  // Reset to page 1 when tab / search / pageSize changes
  useEffect(() => { setCurrentPage(1); }, [activeTab, search, pageSize]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleAdd = async (form) => {
    await createWord({ ...form, tab_id: activeTab });
    await loadPage(activeTab, 1, pageSize, search);
    setCurrentPage(1);
  };

  const handleEdit = async (form) => {
    await updateWord(editEntry.word_id, form);
    await loadPage(activeTab, currentPage, pageSize, search);
  };

  const handleDelete = async () => {
    await deleteWord(deleteEntry.word_id);
    setDeleteEntry(null);
    // If deleting last item on a page > 1, go back one page
    const newPage = entries.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
    setCurrentPage(newPage);
    await loadPage(activeTab, newPage, pageSize, search);
  };

  const handleDetailSave = async (word_id, html) => {
    await updateWord(word_id, { detail: html });
    await loadPage(activeTab, currentPage, pageSize, search);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4F1", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Serif+JP&family=Noto+Serif+SC&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#1C1C1E", padding: "28px 16px 0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#F5F0EA", letterSpacing: "-0.02em" }}>Lexicon</h1>
            <span style={{ fontSize: 12, color: "#777", fontWeight: 500 }}>Multilingual Glossary</span>
          </div>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>IT · Business · Language</p>

          {/* Tabs — horizontal scroll on mobile */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); }}
                style={{ background: activeTab === t.id ? "#F7F4F1" : "transparent", border: "none", cursor: "pointer", padding: "10px 16px 12px", borderRadius: "8px 8px 0 0", transition: "background 0.15s", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: activeTab === t.id ? t.accent : "#666", whiteSpace: "nowrap" }}>{t.label}</div>
                <div style={{ fontSize: 10, color: activeTab === t.id ? "#888" : "#444", marginTop: 1, whiteSpace: "nowrap" }}>{t.sublabel}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 48px" }}>

        {/* Search + Add */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", position: "relative", minWidth: 0 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#bbb" }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab?.label}…`}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 32px", fontSize: 14, borderRadius: 9, border: "1.5px solid #E0DBD5", background: "#fff", outline: "none", fontFamily: "inherit" }} />
          </div>
          <button onClick={() => { setEditEntry(null); setShowModal(true); }}
            style={{ background: tab?.accent, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            + Add word
          </button>
        </div>

        {/* Count + page size — stack on mobile */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 12, color: "#aaa", margin: 0, fontWeight: 500 }}>
            {loading ? "Loading…" : `${pagination.total} ${pagination.total === 1 ? "entry" : "entries"}`}
            {search && !loading && ` for "${search}"`}
            {pagination.total_pages > 1 && !loading && (
              <span style={{ color: "#ccc" }}> · page {pagination.page}/{pagination.total_pages}</span>
            )}
          </p>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
            style={{ fontSize: 12, fontWeight: 600, color: "#555", border: "1.5px solid #E0DBD5", borderRadius: 7, padding: "4px 24px 4px 10px", background: "#fff", cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23aaa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 14, color: "#e74c3c" }}>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E8E4DF", padding: "16px 20px", height: 80, opacity: 0.5 + (i * 0.1) }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
            <div style={{ fontSize: 36 }}>∅</div>
            <p style={{ marginTop: 12, fontSize: 14 }}>
              {search ? `No entries found for "${search}"` : "No entries yet. Add your first word!"}
            </p>
          </div>
        )}

        {/* Cards */}
        {!loading && entries.length > 0 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.map(entry => (
                <GlossaryCard
                  key={entry.word_id}
                  entry={entry}
                  accent={tab?.accent}
                  accentBg={tab?.accentBg}
                  activeTab={activeTab}
                  onDetailSave={handleDetailSave}
                  onEdit={(e) => { setEditEntry(e); setShowModal(true); }}
                  onDelete={(e) => setDeleteEntry(e)}
                />
              ))}
            </div>
            <PaginationBar
              currentPage={currentPage}
              totalPages={pagination.total_pages}
              accent={tab?.accent}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit modal */}
      {showModal && tab && (
        <WordModal
          tab={tab}
          entry={editEntry}
          onSave={editEntry ? handleEdit : handleAdd}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteEntry && (
        <ConfirmDeleteModal
          entry={deleteEntry}
          accent={tab?.accent}
          onConfirm={handleDelete}
          onClose={() => setDeleteEntry(null)}
        />
      )}
    </div>
  );
}
