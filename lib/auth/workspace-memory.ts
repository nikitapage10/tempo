import { ACTIVE_ARTIST_KEY, ACTIVE_SPACE_KEY } from "@/lib/constants";

export function artistMemoryKey(userId: string): string {
  return `${ACTIVE_ARTIST_KEY}:${userId}`;
}

export function spaceMemoryKey(userId: string): string {
  return `${ACTIVE_SPACE_KEY}:${userId}`;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Which artist this account was last working as.
 *
 * Scoped by user so signing into a different account cannot inherit the
 * previous person's artist — and signing back in restores this account's.
 * Falls back to the old shared key once, then migrates it.
 */
export function readStoredArtistId(userId: string | null | undefined): string | null {
  if (userId) {
    const scoped = read(artistMemoryKey(userId));
    if (scoped) return scoped;
  }
  return read(ACTIVE_ARTIST_KEY);
}

export function writeStoredArtistId(
  userId: string | null | undefined,
  id: string
) {
  if (userId) {
    write(artistMemoryKey(userId), id);
    remove(ACTIVE_ARTIST_KEY);
    return;
  }
  write(ACTIVE_ARTIST_KEY, id);
}

export function readStoredSpaceId(userId: string | null | undefined): string | null {
  if (userId) {
    const scoped = read(spaceMemoryKey(userId));
    if (scoped) return scoped;
  }
  return read(ACTIVE_SPACE_KEY);
}

export function writeStoredSpaceId(
  userId: string | null | undefined,
  id: string
) {
  if (userId) {
    write(spaceMemoryKey(userId), id);
    remove(ACTIVE_SPACE_KEY);
    return;
  }
  write(ACTIVE_SPACE_KEY, id);
}

/** Shared keys only — per-account artist/space memory stays so you can come back. */
export function clearLegacyWorkspaceMemory() {
  remove(ACTIVE_ARTIST_KEY);
  remove(ACTIVE_SPACE_KEY);
}
