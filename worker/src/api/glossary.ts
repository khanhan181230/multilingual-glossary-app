// ── Config ────────────────────────────────────────────────────────────────────
// Set VITE_WORKER_URL in your .env.local file:
//   VITE_WORKER_URL=https://glossary-worker.glossary-app.workers.dev

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

if (!WORKER_URL) {
  console.warn("[api] VITE_WORKER_URL is not set — falling back to mock data");
}

// ── Types (mirrored from worker/src/types/glossary.ts) ────────────────────────

export type TabId = "it-japanese" | "advanced-chinese" | "business-english";

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
  tags:           string | null;
  detail:         string | null;
  origin:         "sheet" | "ui";
}

export interface PaginatedResponse {
  data:        GlossaryEntry[];
  page:        number;
  page_size:   number;
  total:       number;
  total_pages: number;
}

export interface CreateWordPayload {
  tab_id:          TabId;
  term:            string;
  definition:      string;
  reading?:        string;
  translation_en?: string;
  translation_vi?: string;
  translation_zh?: string;
  translation_ja?: string;
  example?:        string;
  tags?:           string;
  detail?:         string;
}

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

// ── Base fetch helper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path:    string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(
      (err as { message?: string }).message ?? `HTTP ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

// ── GET /glossary/:tab ────────────────────────────────────────────────────────

export async function fetchGlossaryPage(
  tab_id:    TabId,
  page:      number      = 1,
  page_size: number      = 10,
  search?:   string
): Promise<PaginatedResponse> {
  const params = new URLSearchParams({
    page:      String(page),
    page_size: String(page_size),
  });

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  return apiFetch<PaginatedResponse>(
    `/glossary/${tab_id}?${params.toString()}`
  );
}

// ── POST /admin/words ─────────────────────────────────────────────────────────

export async function createWord(
  payload: CreateWordPayload
): Promise<{ success: true; word_id: string }> {
  return apiFetch("/admin/words", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
}

// ── PATCH /admin/words/:id ────────────────────────────────────────────────────

export async function updateWord(
  word_id: string,
  payload: UpdateWordPayload
): Promise<{ success: true }> {
  return apiFetch(`/admin/words/${word_id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
  });
}

// ── DELETE /admin/words/:id ───────────────────────────────────────────────────

export async function deleteWord(
  word_id: string
): Promise<{ success: true }> {
  return apiFetch(`/admin/words/${word_id}`, {
    method: "DELETE",
  });
}