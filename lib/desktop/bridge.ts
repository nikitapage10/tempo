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
  zoom: {
    in: () => Promise<number>;
    out: () => Promise<number>;
    reset: () => Promise<number>;
    get: () => Promise<number>;
  };
  /** Optional until every pre-banner desktop install has updated. */
  updates?: {
    getState: () => Promise<DesktopUpdateState>;
    install: () => Promise<boolean>;
    onStateChange: (callback: (state: DesktopUpdateState) => void) => () => void;
  };
  /** Optional while older desktop shells roll forward to native alerts. */
  notifications?: {
    show: (input: {
      kind: "message" | "notification";
      title: string;
      body?: string | null;
      url?: string | null;
    }) => Promise<boolean>;
    onOpen: (callback: (url: string) => void) => () => void;
  };
};

export type DesktopUpdateState = {
  ready: boolean;
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

export async function getDesktopUpdateState(): Promise<DesktopUpdateState> {
  const updates = bridge()?.updates;
  if (!updates) return { ready: false };
  try {
    return await updates.getState();
  } catch {
    return { ready: false };
  }
}

export async function installDesktopUpdate(): Promise<boolean> {
  const updates = bridge()?.updates;
  if (!updates) return false;
  try {
    return await updates.install();
  } catch {
    return false;
  }
}

export async function showDesktopNotification(input: {
  kind: "message" | "notification";
  title: string;
  body?: string | null;
  url?: string | null;
}): Promise<boolean> {
  const notifications = bridge()?.notifications;
  if (!notifications) return false;
  try {
    return await notifications.show(input);
  } catch {
    return false;
  }
}

export function onDesktopUpdateStateChange(
  callback: (state: DesktopUpdateState) => void
): () => void {
  const updates = bridge()?.updates;
  if (!updates) return () => {};
  return updates.onStateChange(callback);
}

export function onDesktopNotificationOpen(callback: (url: string) => void): () => void {
  const notifications = bridge()?.notifications;
  if (!notifications) return () => {};
  return notifications.onOpen(callback);
}

/**
 * Desktop-only interface zoom — there's no visible menu bar to hang the
 * usual Ctrl+=/-/0 accelerators off (see electron/main.js), so this backs
 * both a keyboard shortcut and a visible on-screen control
 * (components/desktop/zoom-control.tsx). All resolve to the new zoom factor
 * (1.0 = 100%) so the control can stay in sync; no-ops to 1.0 outside desktop.
 */
export async function zoomIn(): Promise<number> {
  const b = bridge();
  if (!b) return 1;
  return b.zoom.in();
}

export async function zoomOut(): Promise<number> {
  const b = bridge();
  if (!b) return 1;
  return b.zoom.out();
}

export async function zoomReset(): Promise<number> {
  const b = bridge();
  if (!b) return 1;
  return b.zoom.reset();
}

export async function getZoomFactor(): Promise<number> {
  const b = bridge();
  if (!b) return 1;
  try {
    return await b.zoom.get();
  } catch {
    return 1;
  }
}
