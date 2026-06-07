import type { Env, TabId } from "../types/glossary";
import { logSync } from "../db/queries";

// ── logSyncEvent ──────────────────────────────────────────────────────────────
// Thin wrapper around the D1 logSync query.
// Centralises sync event logging so routes and services
// don't call db/queries directly for this concern.

export async function logSyncEvent(
  env:           Env,
  method:        "push" | "poll",
  tab_id:        TabId | null,
  rowsAffected:  number,
  status:        "success" | "failed",
  errorMessage?: string
): Promise<void> {
  try {
    await logSync(
      env,
      method,
      tab_id,
      rowsAffected,
      status,
      errorMessage ?? null
    );
  } catch (err) {
    // Never let a logging failure crash the main operation
    console.error("[syncLogger] Failed to write sync log:", err);
  }
}