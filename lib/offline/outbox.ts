"use client";

import { createClient } from "@/lib/supabase/client";
import { idbAdd, idbDelete, idbGetAll, OUTBOX_STORE } from "@/lib/offline/db";

/**
 * Offline write (TEMPO Desktop Package 5, planning/desktop/02 §6). A
 * durable, generic mutation queue rather than one bespoke queue per domain
 * — TEMPO's offline-eligible writes (a task's status, a track's next move,
 * a project's deadline, a calendar event's date) are almost all a single
 * `update(patch).eq(id)` against one table, so one descriptor shape covers
 * them instead of duplicating queue plumbing per feature.
 *
 * Scope note: this is genuinely wired into task completion
 * (lib/api/tasks.ts) as the first, representative integration end-to-end.
 * Extending every mutation across tracks/projects/calendar/board to route
 * through here is follow-up work, not something this pass silently claims.
 */

export type OutboxMutation =
  | { type: "supabase_update"; table: string; id: string; idColumn?: string; patch: Record<string, unknown> }
  | { type: "supabase_insert"; table: string; row: Record<string, unknown> }
  | { type: "supabase_delete"; table: string; id: string; idColumn?: string };

export type OutboxEntry = {
  id: number;
  mutation: OutboxMutation;
  /** The row's updated_at at the moment this was queued — used to detect a conflicting edit made elsewhere before replay. */
  capturedUpdatedAt: string | null;
  createdAt: string;
  attempts: number;
};

export async function enqueue(
  mutation: OutboxMutation,
  capturedUpdatedAt: string | null = null
): Promise<void> {
  const entry: Omit<OutboxEntry, "id"> = {
    mutation,
    capturedUpdatedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await idbAdd(OUTBOX_STORE, entry);
}

export async function listPending(): Promise<OutboxEntry[]> {
  const entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
  return entries.sort((a, b) => a.id - b.id);
}

async function execute(mutation: OutboxMutation, capturedUpdatedAt: string | null): Promise<{ conflict: boolean }> {
  const supabase = createClient();

  if (mutation.type === "supabase_update") {
    const idColumn = mutation.idColumn ?? "id";
    if (capturedUpdatedAt) {
      const { data: current } = await supabase
        .from(mutation.table)
        .select("updated_at")
        .eq(idColumn, mutation.id)
        .maybeSingle();
      if (
        current &&
        typeof current.updated_at === "string" &&
        current.updated_at !== capturedUpdatedAt
      ) {
        // Someone else's edit landed first — don't blindly overwrite it.
        return { conflict: true };
      }
    }
    const { error } = await supabase.from(mutation.table).update(mutation.patch).eq(idColumn, mutation.id);
    if (error) throw error;
    return { conflict: false };
  }

  if (mutation.type === "supabase_insert") {
    const { error } = await supabase.from(mutation.table).insert(mutation.row);
    if (error) throw error;
    return { conflict: false };
  }

  const idColumn = mutation.idColumn ?? "id";
  const { error } = await supabase.from(mutation.table).delete().eq(idColumn, mutation.id);
  if (error) throw error;
  return { conflict: false };
}

/** Best-effort classification — treated as "network unavailable" rather than a real failure. */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch's own "Failed to fetch"
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

/**
 * Runs a mutation immediately when online; queues it durably and applies
 * nothing further here when offline (the caller is expected to have already
 * applied its own optimistic cache update, same as TEMPO's existing
 * optimistic-mutation convention). Returns whether it was queued.
 */
export async function runOrQueue(
  mutation: OutboxMutation,
  capturedUpdatedAt: string | null = null
): Promise<{ queued: boolean; conflict: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue(mutation, capturedUpdatedAt);
    return { queued: true, conflict: false };
  }
  try {
    const { conflict } = await execute(mutation, capturedUpdatedAt);
    if (conflict) {
      // Online but stale: don't queue a blind overwrite — surface it now.
      return { queued: false, conflict: true };
    }
    return { queued: false, conflict: false };
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue(mutation, capturedUpdatedAt);
      return { queued: true, conflict: false };
    }
    throw err;
  }
}

export type FlushResult = {
  applied: number;
  conflicts: OutboxEntry[];
  stillPending: number;
};

/**
 * Replays queued mutations in the order they were made. A conflicting entry
 * is removed from the queue (not silently applied) and reported back so the
 * caller can surface it; any other failure leaves the entry queued for the
 * next flush rather than blocking entries behind it.
 */
export async function flushOutbox(): Promise<FlushResult> {
  const pending = await listPending();
  let applied = 0;
  const conflicts: OutboxEntry[] = [];

  for (const entry of pending) {
    try {
      const { conflict } = await execute(entry.mutation, entry.capturedUpdatedAt);
      await idbDelete(OUTBOX_STORE, entry.id);
      if (conflict) {
        conflicts.push(entry);
      } else {
        applied += 1;
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Still offline (or the connection dropped mid-flush) — stop here,
        // the rest stay queued for the next attempt.
        break;
      }
      // A real error (permissions, validation) — leave it queued but don't
      // let one bad entry jam everything behind it.
      console.warn("[offline] outbox entry failed, will retry later", entry, err);
    }
  }

  const stillPending = await listPending();
  return { applied, conflicts, stillPending: stillPending.length };
}
