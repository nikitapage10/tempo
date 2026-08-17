"use client";

import type { Query, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  idbClear,
  idbGetAll,
  idbSet,
  OUTBOX_STORE,
  QUERY_CACHE_STORE,
} from "@/lib/offline/db";
import { isDesktopApp } from "@/lib/desktop/bridge";

export const OFFLINE_CACHE_USER_KEY = "tempo.offlineCacheUserId";

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
  "task-categories",
  "board-notes",
];

function isOfflineEligible(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  return typeof first === "string" && OFFLINE_KEY_PREFIXES.includes(first);
}

function storageKeyFor(userId: string, queryKey: readonly unknown[]): string {
  return `${userId}:${JSON.stringify(queryKey)}`;
}

type PersistedQuery = {
  queryKey: unknown[];
  data: unknown;
  updatedAt: string;
  userId?: string;
};

export function readOfflineCacheUser(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(OFFLINE_CACHE_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberOfflineCacheUser(userId: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!userId) localStorage.removeItem(OFFLINE_CACHE_USER_KEY);
    else localStorage.setItem(OFFLINE_CACHE_USER_KEY, userId);
  } catch {
    /* ignore */
  }
}

/** Restore only the signed-in account's cache — never another person's catalog. */
export function canRestoreOfflineCache(
  sessionUserId: string | null,
  cacheUserId: string | null
): boolean {
  return !!sessionUserId && !!cacheUserId && sessionUserId === cacheUserId;
}

export function entryBelongsToUser(
  entry: { userId?: string },
  sessionUserId: string | null
): boolean {
  return !!sessionUserId && entry.userId === sessionUserId;
}

/** Drop queued offline writes so they cannot flush as a different account. */
export async function clearOfflineOutbox(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await idbClear(OUTBOX_STORE);
  } catch (err) {
    console.warn("[offline] outbox clear failed", err);
  }
}

/**
 * Loads this account's persisted entries into the query cache before the app
 * renders. Other accounts' rows stay on disk so signing back in still has them.
 */
export async function hydrateOfflineCache(queryClient: QueryClient): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    const { data } = await createClient().auth.getSession();
    const sessionUserId = data.session?.user?.id ?? null;
    if (!sessionUserId) return;
    rememberOfflineCacheUser(sessionUserId);
    const entries = await idbGetAll<PersistedQuery>(QUERY_CACHE_STORE);
    for (const entry of entries) {
      if (!entryBelongsToUser(entry, sessionUserId)) continue;
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

    const userId = readOfflineCacheUser();
    if (!userId) {
      void createClient()
        .auth.getSession()
        .then(({ data }) => {
          const nextId = data.session?.user?.id ?? null;
          if (nextId) rememberOfflineCacheUser(nextId);
        })
        .catch(() => {
          /* owner tag is a safety net, not required for the write */
        });
      return;
    }
    const key = storageKeyFor(userId, query.queryKey);
    const entry: PersistedQuery = {
      queryKey: [...query.queryKey],
      data: query.state.data,
      updatedAt: new Date().toISOString(),
      userId,
    };
    void idbSet(QUERY_CACHE_STORE, key, entry).catch((err) => {
      console.warn("[offline] cache write failed", key, err);
    });
  });
}
