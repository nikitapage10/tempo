import type { UserDevice } from "@/hooks/use-devices";
import { detectOS } from "@/lib/platform";

/** Desktop builds before this lack a working tempo:// handler. */
export const DESKTOP_LINK_MIN_VERSION = [0, 100, 10] as const;

export function supportsDesktopLink(version: string): boolean {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return DESKTOP_LINK_MIN_VERSION.every((minimum, index) => {
    const current = Number.isFinite(parts[index]) ? parts[index] : 0;
    const earlierPartsMatch = DESKTOP_LINK_MIN_VERSION
      .slice(0, index)
      .every((part, earlierIndex) => (parts[earlierIndex] ?? 0) === part);
    return !earlierPartsMatch || current >= minimum;
  });
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
  activeDevice?: UserDevice;
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

  if (activeDevice && supportsDesktopLink(activeDevice.app_version)) {
    return {
      kind: "open-desktop",
      label: "Open in desktop",
      href: `tempo://open?path=${encodeURIComponent(pathname)}`,
      secondaryHref: windowsInstallerUrl,
      secondaryLabel: "Get the installer",
    };
  }

  if (activeDevice) {
    return {
      kind: "update-desktop",
      label: "Update TEMPO Desktop",
      href: windowsInstallerUrl,
      secondaryHref: "/download",
      secondaryLabel: "Desktop details",
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
