"use client";

import { desktopAppVersion, desktopPlatform, isDesktopApp } from "@/lib/desktop/bridge";

const DEVICE_ID_KEY = "tempo:desktop-device-id";

// Re-registering (refreshing last_seen_at) more than once per interval is
// pointless network traffic; a device is treated as "still installed" by
// hooks/use-devices.ts for 30 days, so anything faster than that is plenty.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
let lastRefreshAt = 0;
let pending: Promise<string | null> | null = null;

function cachedDeviceId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(DEVICE_ID_KEY);
}

function cacheDeviceId(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DEVICE_ID_KEY, id);
}

/**
 * Registers this desktop install with the signed-in account (or refreshes
 * its last_seen_at if already registered) — see migrations/080_desktop_devices.sql
 * and hooks/use-devices.ts, which is what flips the web app's download
 * button to "Open in desktop." Safe to call often; internally throttled.
 * No-ops entirely outside the desktop app.
 */
export async function ensureDeviceRegistered(): Promise<string | null> {
  if (!isDesktopApp()) return null;

  const existing = cachedDeviceId();
  if (existing && Date.now() - lastRefreshAt < REFRESH_INTERVAL_MS) {
    return existing;
  }
  if (pending) return pending;

  pending = (async () => {
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: existing || undefined,
          platform: desktopPlatform(),
          name: `${desktopPlatform() === "mac" ? "Mac" : "Windows"} desktop`,
          appVersion: desktopAppVersion(),
        }),
      });
      if (!res.ok) return existing;
      const data = await res.json().catch(() => null);
      const id = typeof data?.deviceId === "string" ? data.deviceId : existing;
      if (id) {
        cacheDeviceId(id);
        lastRefreshAt = Date.now();
      }
      return id;
    } catch {
      return existing;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

export function getCachedDeviceId(): string | null {
  return cachedDeviceId();
}
