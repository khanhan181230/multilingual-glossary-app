import type { Env, TabId, PaginatedResponse } from "../types/glossary";

// ── Key builders ──────────────────────────────────────────────────────────────
// Centralised key format so every part of the codebase uses the same shape.
// Format: "glossary:{tab_id}:page:{page}:size:{page_size}:search:{search}"

const KV_TTL_SECONDS = 300; // Cache entries expire after 5 minutes

function buildPageKey(
  tab_id:    TabId,
  page:      number,
  page_size: number,
  search?:   string
): string {
  const searchPart = search?.trim() ? `:search:${search.trim().toLowerCase()}` : "";
  return `glossary:${tab_id}:page:${page}:size:${page_size}${searchPart}`;
}

function buildTabPrefix(tab_id: TabId): string {
  return `glossary:${tab_id}:`;
}

// ── Read ──────────────────────────────────────────────────────────────────────
// Attempts to return a cached paginated response.
// Returns null on cache miss — caller falls through to D1.

export async function getCachedPage(
  env:       Env,
  tab_id:    TabId,
  page:      number,
  page_size: number,
  search?:   string
): Promise<PaginatedResponse | null> {
  const key   = buildPageKey(tab_id, page, page_size, search);
  const value = await env.GLOSSARY_CACHE.get(key);

  if (!value) return null;

  try {
    return JSON.parse(value) as PaginatedResponse;
  } catch {
    // Corrupted cache entry — treat as miss
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────
// Caches a paginated response with a TTL.
// Fire-and-forget — never awaited in hot paths so it doesn't slow responses.

export async function setCachedPage(
  env:       Env,
  tab_id:    TabId,
  page:      number,
  page_size: number,
  data:      PaginatedResponse,
  search?:   string
): Promise<void> {
  const key = buildPageKey(tab_id, page, page_size, search);

  await env.GLOSSARY_CACHE.put(key, JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

// ── Invalidate ────────────────────────────────────────────────────────────────
// Called after any INSERT, UPDATE, or DELETE on a tab.
// Lists and deletes all KV keys that belong to the affected tab.
//
// KV list + delete is eventually consistent — there may be a brief window
// where stale data is served after a write. Acceptable for this use case.

export async function invalidateTab(
  env:    Env,
  tab_id: TabId
): Promise<void> {
  const prefix = buildTabPrefix(tab_id);
  let   cursor: string | undefined;

  // KV list is paginated — loop until all keys for this tab are deleted
  do {
    const listed = await env.GLOSSARY_CACHE.list({
      prefix,
      cursor,
    });

    if (listed.keys.length > 0) {
      await Promise.all(
        listed.keys.map((k) => env.GLOSSARY_CACHE.delete(k.name))
      );
    }

    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}

// ── Cache-aside helper ────────────────────────────────────────────────────────
// Wraps the full read-through pattern:
//   1. Check KV cache
//   2. On miss: call fetchFn() to get from D1
//   3. Write result back to KV
//   4. Return result
//
// Usage:
//   const result = await withCache(env, tab_id, page, size, search, () =>
//     queryGlossaryPage(env, tab_id, page, size, search)
//   );

export async function withCache(
  env:       Env,
  tab_id:    TabId,
  page:      number,
  page_size: number,
  search:    string | undefined,
  fetchFn:   () => Promise<PaginatedResponse>
): Promise<PaginatedResponse> {
  // 1. Try cache first
  const cached = await getCachedPage(env, tab_id, page, page_size, search);
  if (cached) return cached;

  // 2. Cache miss — fetch from D1
  const fresh = await fetchFn();

  // 3. Write to cache (non-blocking — don't await so response isn't delayed)
  env.GLOSSARY_CACHE.put(
    buildPageKey(tab_id, page, page_size, search),
    JSON.stringify(fresh),
    { expirationTtl: KV_TTL_SECONDS }
  );

  return fresh;
}