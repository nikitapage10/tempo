/** Best-effort OS detection for the download button — cosmetic only, never a security or feature gate. */
export type DetectedOS = "windows" | "mac" | "other";

export function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return "other";
  const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  if (platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad")) {
    return "mac";
  }
  if (platform.includes("win")) return "windows";
  return "other";
}

// True only inside the Electron shell — set by the preload bridge, never
// guessed. Re-exported here so existing `lib/platform` callers don't need
// to know the fuller desktop bridge lives in lib/desktop/bridge.
export { isDesktopApp } from "@/lib/desktop/bridge";
