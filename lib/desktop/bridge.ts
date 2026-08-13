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
  /** Optional until every pre–system-browser-OAuth install has updated. */
  openExternal?: (url: string) => Promise<boolean>;
  zoom: {
    in: () => Promise<number>;
    out: () => Promise<number>;
    reset: () => Promise<number>;
    get: () => Promise<number>;
    /** Optional: shell Ctrl/Cmd +/- nudges content zoom (CSS on main). */
    onNudge?: (callback: (delta: number) => void) => () => void;
    /** Force Chromium page zoom back to 1 so only content CSS zoom applies. */
    resetNative?: () => Promise<number>;
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
      ice?: string | null;
      amber?: string | null;
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

export function onDesktopUpdateStateChange(
  callback: (state: DesktopUpdateState) => void
): () => void {
  const updates = bridge()?.updates;
  if (!updates) return () => {};
  return updates.onStateChange(callback);
}

export async function showDesktopNotification(input: {
  kind: "message" | "notification";
  title: string;
  body?: string | null;
  url?: string | null;
  /** Active artist Cool/Warm — matches profile palette in the toast. */
  ice?: string | null;
  amber?: string | null;
}): Promise<boolean> {
  const notifications = bridge()?.notifications;
  if (!notifications) return false;
  try {
    return await notifications.show(input);
  } catch {
    return false;
  }
}

/** Normalize CSS / artist accent values into #RRGGBB for glass alerts. */
export function normalizeAccentHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return `#${v.slice(1).toUpperCase()}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const a = v[1];
    const b = v[2];
    const c = v[3];
    return `#${a}${a}${b}${b}${c}${c}`.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(v)) return `#${v.toUpperCase()}`;
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const h = (n: string) =>
      Math.max(0, Math.min(255, Number(n)))
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`;
  }
  return null;
}

/** Read the live artist palette from the document (ArtistThemeProvider). */
export function readDesktopAlertAccents(): { ice: string; amber: string } {
  if (typeof document === "undefined") {
    return { ice: "#7FB4FF", amber: "#FFB56B" };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    ice: normalizeAccentHex(styles.getPropertyValue("--ice")) ?? "#7FB4FF",
    amber: normalizeAccentHex(styles.getPropertyValue("--amber")) ?? "#FFB56B",
  };
}

export function onDesktopNotificationOpen(callback: (url: string) => void): () => void {
  const notifications = bridge()?.notifications;
  if (!notifications) return () => {};
  return notifications.onOpen(callback);
}

/**
 * Desktop interface zoom. The left rail stays at 100% — only the main
 * workspace scales (see hooks/use-content-zoom.ts). Older shells that still
 * call setZoomFactor are cleared via resetNativePageZoom on mount.
 */
export async function zoomIn(): Promise<number> {
  if (!isDesktopApp()) return 1;
  const { nudgeContentZoom } = await import("@/lib/desktop/content-zoom");
  await resetNativePageZoom();
  return nudgeContentZoom(0.1);
}

export async function zoomOut(): Promise<number> {
  if (!isDesktopApp()) return 1;
  const { nudgeContentZoom } = await import("@/lib/desktop/content-zoom");
  await resetNativePageZoom();
  return nudgeContentZoom(-0.1);
}

export async function zoomReset(): Promise<number> {
  if (!isDesktopApp()) return 1;
  const { writeContentZoom } = await import("@/lib/desktop/content-zoom");
  await resetNativePageZoom();
  return writeContentZoom(1);
}

export async function getZoomFactor(): Promise<number> {
  if (!isDesktopApp()) return 1;
  const { readContentZoom } = await import("@/lib/desktop/content-zoom");
  return readContentZoom();
}

export async function resetNativePageZoom(): Promise<void> {
  const b = bridge();
  if (b?.zoom.resetNative) {
    try {
      await b.zoom.resetNative();
    } catch {
      /* ignore */
    }
    return;
  }
  // Older shell: clear leftover Chromium page zoom once via reset IPC.
  try {
    await b?.zoom.reset();
  } catch {
    /* ignore */
  }
}

/** Shell keyboard shortcuts → content zoom (delta 0 = reset). */
export function onDesktopZoomNudge(
  callback: (delta: number) => void
): () => void {
  const b = bridge();
  if (!b?.zoom.onNudge) return () => {};
  return b.zoom.onNudge(callback);
}

/**
 * Open an https URL in the system browser (desktop OAuth). Capability-detect
 * so older shells fall back to in-app navigation.
 */
export function canOpenExternal(): boolean {
  return typeof bridge()?.openExternal === "function";
}

export async function openExternal(url: string): Promise<boolean> {
  const b = bridge();
  if (!b?.openExternal) return false;
  try {
    return await b.openExternal(url);
  } catch {
    return false;
  }
}
