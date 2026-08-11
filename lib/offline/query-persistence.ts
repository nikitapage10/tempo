"use client";

import type { Query, QueryClient } from "@tanstack/react-query";
import { idbGetAll, idbSet, QUERY_CACHE_STORE } from "@/lib/offline/db";
import { isDesktopApp } from "@/lib/desktop/bridge";

/**
 * Offline read (TEMPO Desktop Package 4, planning/desktop/02 §6). Only the
 * five bounded surfaces get a persisted cache — Board (tracks + board
 * notes), Tracks, Projects, Tasks, Calendar — matching
 * planning/desktop/01-PRODUCT-AND-UX-SPEC.md's "Offline" section.
 * Everything else (Artist, Social, Scenes, Stats, Messages, the assistant)
 * is left out on purpose: opening one offline should show the plain
 * "needs a connection" state, not stale or partial data.
 */
const OFFLINE_KEY_PREFIXES = [
  "tracks",
  "track",
  "version-count",
  "tasks",
  "projects",
  "project",
  "project-tracks",
  "project-tasks",
  "calendar",
  "calendar-categories",
  "board-notes",
];

function isOfflineEligible(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  return typeof first === "string" && OFFLINE_KEY_PREFIXES.includes(first);
}

function storageKeyFor(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}

type PersistedQuery = {
  queryKey: unknown[];
  data: unknown;
  updatedAt: string;
};

/**
 * Loads every persisted entry into the query cache before the app renders
 * its first screen. A component's useQuery for the same key then reads this
 * as its initial data instead of starting blank — offline or online, this
 * is what makes reopening TEMPO feel already-caught-up rather than empty
 * while the real fetch (if any) resolves in the background.
 */
export async function hydrateOfflineCache(queryClient: QueryClient): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const entries = await idbGetAll<PersistedQuery>(QUERY_CACHE_STORE);
    for (const entry of entries) {
      queryClient.setQueryData(entry.queryKey, entry.data);
    }
  } catch (err) {
    console.warn("[offline] cache hydration failed", err);
  }
}

/**
 * Subscribes to the query cache and mirrors every successful result for an
 * offline-eligible key into IndexedDB. Returns an unsubscribe function.
 */
export function installOfflinePersistence(queryClient: QueryClient): () => void {
  if (!isDesktopApp()) return () => {};

  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    const query = event.query as Query;
    if (query.state.status !== "success") return;
    if (!isOfflineEligible(query.queryKey)) return;

    const key = storageKeyFor(query.queryKey);
    const entry: PersistedQuery = {
      queryKey: [...query.queryKey],
      data: query.state.data,
      updatedAt: new Date().toISOString(),
    };
    void idbSet(QUERY_CACHE_STORE, key, entry).catch((err) => {
      console.warn("[offline] cache write failed", key, err);
    });
  });
}
