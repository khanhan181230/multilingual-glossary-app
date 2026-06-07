import type { Env, GlossaryEntry } from "../types/glossary";
import {
  getPendingSyncEntries,
  incrementSyncRetry,
  deletePendingSyncEntry,
} from "../db/queries";
import { appendRow, updateRow, deleteRow } from "./sheets";
import { logSyncEvent } from "./syncLogger";

// ── flushRetryQueue ───────────────────────────────────────────────────────────
// Replays all pending_sheets_sync entries in insertion order.
// Called by the Cloudflare Cron Trigger (hourly) defined in wrangler.toml.
//
// Order matters: an UPDATE after a failed INSERT must not run before
// the INSERT is successfully replayed — entries are processed by id ASC.
//
// Dead entries (retry_count >= 5) are skipped and require manual resolution.

export async function flushRetryQueue(env: Env): Promise<void> {
  const entries = await getPendingSyncEntries(env);

  if (entries.length === 0) return;

  console.log(`[retryQueue] Processing ${entries.length} pending entries`);

  let succeeded = 0;
  let failed    = 0;

  for (const entry of entries) {
    try {
      switch (entry.operation) {
        case "INSERT": {
          if (!entry.payload) {
            throw new Error("INSERT entry missing payload");
          }
          const data = JSON.parse(entry.payload) as GlossaryEntry;
          await appendRow(env, entry.tab_id, data);
          break;
        }

        case "UPDATE": {
          if (!entry.payload) {
            throw new Error("UPDATE entry missing payload");
          }
          const data = JSON.parse(entry.payload) as GlossaryEntry;
          await updateRow(env, entry.tab_id, data);
          break;
        }

        case "DELETE": {
          // DELETE only needs word_id — payload is null by design
          await deleteRow(env, entry.tab_id, entry.word_id);
          break;
        }

        default:
          throw new Error(`Unknown operation: ${entry.operation}`);
      }

      // Success — remove from queue
      await deletePendingSyncEntry(env, entry.id);
      succeeded++;

    } catch (err) {
      // Failure — increment retry count (marks as dead at retry_count >= 5)
      console.error(
        `[retryQueue] Entry ${entry.id} (${entry.operation} ${entry.word_id}) failed:`,
        err
      );
      await incrementSyncRetry(env, entry.id);
      failed++;
    }
  }

  // Log the flush result
  await logSyncEvent(
    env,
    "poll",
    null, // null = all tabs
    succeeded,
    failed === 0 ? "success" : "failed",
    failed > 0 ? `${failed} entries failed, ${succeeded} succeeded` : undefined
  );

  console.log(`[retryQueue] Done — ${succeeded} succeeded, ${failed} failed`);
}