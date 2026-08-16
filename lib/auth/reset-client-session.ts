"use client";

import type { QueryClient } from "@tanstack/react-query";
import { isSafeRedirect } from "@/lib/auth/invite-signup";
import {
  PREFER_DEMO_ARTIST_KEY,
  PREFER_ORIGIN_ARTIST_KEY,
} from "@/lib/constants";
import { clearCurrentUserCache } from "@/lib/auth/current-user-cache";
import { clearLegacyWorkspaceMemory } from "@/lib/auth/workspace-memory";
import { clearOfflineOutbox } from "@/lib/offline/query-persistence";
import { createClient } from "@/lib/supabase/client";
import { clearSignedUrlCache } from "@/lib/storage";
import { GUIDED_TOUR_PENDING_KEY } from "@/lib/guided-tour";

const PREFER_PERSONAL_HOME_KEY = "tempo.preferPersonalHome";

let registeredQueryClient: QueryClient | null = null;

/** Lets sign-out / account-switch run from anywhere, not only React trees. */
export function registerQueryClient(client: QueryClient) {
  registeredQueryClient = client;
}

export function accountScopedSessionKeys(): string[] {
  return [
    PREFER_ORIGIN_ARTIST_KEY,
    PREFER_DEMO_ARTIST_KEY,
    PREFER_PERSONAL_HOME_KEY,
    GUIDED_TOUR_PENDING_KEY,
  ];
}

export function clearAuthHandoffKeys() {
  removeKeys(
    typeof sessionStorage === "undefined" ? undefined : sessionStorage,
    accountScopedSessionKeys()
  );
}

function removeKeys(
  storage: Pick<Storage, "removeItem"> | undefined,
  keys: string[]
) {
  if (!storage) return;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      /* private mode / quota */
    }
  }
}

/**
 * Drop in-memory leftovers from the previous account so the next sign-in
 * cannot show their catalog or permissions. Each account's last artist and
 * the desktop offline cache for that account stay, so coming back is intact.
 */
export async function resetClientSession(
  queryClient: QueryClient | null = registeredQueryClient
): Promise<void> {
  queryClient?.clear();
  clearCurrentUserCache();
  clearSignedUrlCache();
  clearLegacyWorkspaceMemory();
  await clearOfflineOutbox();
}

export function reloadAsSignedIn(path: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(isSafeRedirect(path) ? path : "/");
}

/** After a successful sign-in, wipe leftovers then load the app as this account. */
export async function finishAuthNavigation(path: string): Promise<void> {
  await resetClientSession();
  reloadAsSignedIn(path);
}

export async function signOutOfTempo(redirectTo = "/login"): Promise<void> {
  const supabase = createClient();
  try {
    await supabase.auth.signOut();
  } finally {
    clearAuthHandoffKeys();
    await resetClientSession();
    if (typeof window !== "undefined") {
      window.location.assign(redirectTo);
    }
  }
}
