import { detectOS } from "@/lib/platform";

/** Minimal device shape for handoff ranking (matches hooks/use-devices). */
export type DesktopDeviceRef = {
  id: string;
  app_version: string;
  last_seen_at: string;
};

/** Desktop builds before this lack a working tempo:// handler. */
export const DESKTOP_LINK_MIN_VERSION = [0, 100, 10] as const;

/** Must match electron/package.json — fallback pin if the public channel is empty. */
export const DESKTOP_SHELL_VERSION = "0.100.27";

/**
 * Fallback Windows installer URL (version-pinned). Live Download prefers
 * whatever GitHub marks as latest — see app/api/desktop/windows/route.ts.
 */
export const DESKTOP_PUBLIC_CHANNEL_INSTALLER_URL =
  `https://github.com/nikitapage10/tempo-desktop-releases/releases/download/v${DESKTOP_SHELL_VERSION}/TEMPO-Setup.exe`;

/**
 * Fallback Mac DMG URL (same pin). Live Download prefers the public latest.
 * Override with NEXT_PUBLIC_DESKTOP_MAC_URL if needed.
 */
export const DESKTOP_MAC_INSTALLER_URL =
  process.env.NEXT_PUBLIC_DESKTOP_MAC_URL ||
  `https://github.com/nikitapage10/tempo-desktop-releases/releases/download/v${DESKTOP_SHELL_VERSION}/TEMPO-Mac.dmg`;

/** Bundled Windows beta kept in the web app as a last-resort fallback. */
export const DESKTOP_WINDOWS_BUNDLED_FALLBACK_URL = "/downloads/TEMPO-Setup-0.100.6.exe";

/**
 * Stable Windows download entry used by the Download page, welcome chooser,
 * and invite email. Resolves to the pinned public-channel installer when live,
 * otherwise the bundled beta — see app/api/desktop/windows/route.ts.
 * Override with NEXT_PUBLIC_DESKTOP_WINDOWS_URL to pin a specific asset.
 */
export const DESKTOP_WINDOWS_INSTALLER_URL =
  process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL || "/api/desktop/windows";

/**
 * Stable Mac download entry — same pattern as Windows.
 */
export const DESKTOP_MAC_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_MAC_URL || "/api/desktop/mac";

function versionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** Newest first. Equal versions return 0. */
export function compareDesktopVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function supportsDesktopLink(version: string): boolean {
  const parts = versionParts(version);
  return DESKTOP_LINK_MIN_VERSION.every((minimum, index) => {
    const current = parts[index] ?? 0;
    const earlierPartsMatch = DESKTOP_LINK_MIN_VERSION
      .slice(0, index)
      .every((part, earlierIndex) => (parts[earlierIndex] ?? 0) === part);
    return !earlierPartsMatch || current >= minimum;
  });
}

/**
 * Among recently-seen installs, prefer one that can open tempo://, then the
 * highest reported app version. Stops an older leftover row from forcing
 * "Update TEMPO" after a newer install has checked in.
 */
export function pickActiveDesktopDevice<T extends DesktopDeviceRef>(
  devices: T[],
  nowMs = Date.now(),
  recentWindowMs = 30 * 24 * 60 * 60 * 1000
): T | undefined {
  const cutoff = nowMs - recentWindowMs;
  const recent = devices.filter((d) => {
    const seen = Date.parse(d.last_seen_at);
    return Number.isFinite(seen) && seen >= cutoff;
  });
  if (!recent.length) return undefined;

  const ranked = [...recent].sort((a, b) => {
    const linkDelta =
      Number(supportsDesktopLink(b.app_version)) -
      Number(supportsDesktopLink(a.app_version));
    if (linkDelta !== 0) return linkDelta;
    const versionDelta = compareDesktopVersions(b.app_version, a.app_version);
    if (versionDelta !== 0) return versionDelta;
    return Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at);
  });
  return ranked[0];
}

export type DesktopHandoffKind =
  | "open-web"
  | "open-desktop"
  | "update-desktop"
  | "download-windows"
  | "download-mac"
  | "download-desktop";

export type DesktopHandoff = {
  kind: DesktopHandoffKind;
  label: string;
  /** Primary action href — tempo://, /download, installer, or web URL. */
  href: string;
  /** Quieter reinstall link when the primary action is open/update. */
  secondaryHref?: string;
  secondaryLabel?: string;
};

/**
 * Shared rail + /download + welcome chooser logic for web ↔ desktop handoff.
 */
export function resolveDesktopHandoff(opts: {
  isDesktop: boolean;
  pathname: string;
  activeDevice?: DesktopDeviceRef;
  webAppUrl: string;
  windowsInstallerUrl: string;
}): DesktopHandoff {
  const { isDesktop, pathname, activeDevice, webAppUrl, windowsInstallerUrl } = opts;
  const os = detectOS();

  if (isDesktop) {
    return {
      kind: "open-web",
      label: "Open web app",
      href: `${webAppUrl}${pathname}`,
    };
  }

  if (activeDevice) {
    // Any recent registered install means desktop is in play. Prefer Open even
    // when the stored version is stale — an updated app may not have
    // re-checked-in yet, and "Update" was trapping people on an old installer.
    const canLink = supportsDesktopLink(activeDevice.app_version);
    return {
      kind: "open-desktop",
      label: "Open in desktop",
      href: `tempo://open?path=${encodeURIComponent(pathname)}`,
      secondaryHref: windowsInstallerUrl,
      secondaryLabel: canLink ? "Get the installer" : "Update TEMPO",
    };
  }

  if (os === "mac") {
    return { kind: "download-mac", label: "Download for Mac", href: "/download" };
  }
  if (os === "windows") {
    return {
      kind: "download-windows",
      label: "Download for Windows",
      href: "/download",
    };
  }
  return { kind: "download-desktop", label: "Download for desktop", href: "/download" };
}
