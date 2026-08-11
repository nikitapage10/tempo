/**
 * Typed wrapper around window.tempoDesktop — the narrow bridge
 * electron/preload.js exposes via contextBridge. Every function here is a
 * safe no-op (returns null/false/undefined) when not running inside the
 * desktop shell, so callers never need their own `isDesktopApp()` guard
 * before using it.
 */

export type DesktopBridge = {
  isDesktop: true;
  platform: "windows" | "mac";
  appVersion: string;
  vault: {
    has: (storagePath: string) => Promise<boolean>;
    stat: (
      storagePath: string
    ) => Promise<{ checksum: string; size: number; updatedAt: string } | null>;
    resolveUrl: (storagePath: string) => Promise<string | null>;
    write: (
      storagePath: string,
      bytes: ArrayBuffer
    ) => Promise<{ checksum: string; size: number }>;
    remove: (storagePath: string) => Promise<void>;
    stats: () => Promise<{ vaultRoot: string; fileCount: number; totalBytes: number }>;
    relocate: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
  };
  sync: {
    setEnabled: (next: boolean) => Promise<void>;
    getEnabled: () => Promise<boolean>;
  };
};

declare global {
  interface Window {
    tempoDesktop?: DesktopBridge;
  }
}

function bridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.tempoDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return bridge() !== null;
}

/** True if this storage path already has a full local copy. */
export async function vaultHas(storagePath: string): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try {
    return await b.vault.has(storagePath);
  } catch {
    return false;
  }
}

/** The vault's record for this path (checksum, size) if present, else null — no network. */
export async function vaultStat(
  storagePath: string
): Promise<{ checksum: string; size: number; updatedAt: string } | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.vault.stat(storagePath);
  } catch {
    return null;
  }
}

/** A `tempo-local://…` URL if the vault already has this path, else null. */
export async function vaultResolveUrl(storagePath: string): Promise<string | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.vault.resolveUrl(storagePath);
  } catch {
    return null;
  }
}

/** Writes bytes into the vault under the same path convention as cloud storage. */
export async function vaultWrite(
  storagePath: string,
  bytes: ArrayBuffer
): Promise<{ checksum: string; size: number } | null> {
  const b = bridge();
  if (!b) return null;
  return b.vault.write(storagePath, bytes);
}

export async function vaultRemove(storagePath: string): Promise<void> {
  const b = bridge();
  if (!b) return;
  try {
    await b.vault.remove(storagePath);
  } catch {
    /* best-effort — a stray local file is a nuisance, not a correctness issue */
  }
}

export async function vaultStats() {
  const b = bridge();
  if (!b) return null;
  return b.vault.stats();
}

export async function vaultRelocate() {
  const b = bridge();
  if (!b) return { ok: false as const, error: "Not running in the desktop app." };
  return b.vault.relocate();
}

export async function getBackgroundSyncEnabled(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try {
    return await b.sync.getEnabled();
  } catch {
    return false;
  }
}

export async function setBackgroundSyncEnabled(next: boolean): Promise<void> {
  const b = bridge();
  if (!b) return;
  await b.sync.setEnabled(next);
}

export function desktopPlatform(): "windows" | "mac" | null {
  return bridge()?.platform ?? null;
}

export function desktopAppVersion(): string | null {
  return bridge()?.appVersion ?? null;
}
