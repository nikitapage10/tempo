"use client";

import { useQuery } from "@tanstack/react-query";
import { pickActiveDesktopDevice } from "@/lib/desktop/handoff";

export type DesktopPlatform = "windows" | "mac";

export type UserDevice = {
  id: string;
  platform: DesktopPlatform;
  name: string;
  app_version: string;
  sync_enabled: boolean;
  last_seen_at: string;
};

// A device is treated as "still installed" if it's checked in within this
// window — old enough to survive a normal offline stretch, short enough that
// an uninstalled app doesn't keep showing "Open in desktop" forever.
const RECENT_DEVICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function fetchDevices(): Promise<UserDevice[]> {
  const res = await fetch("/api/devices");
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.devices) ? data.devices : [];
}

export function useDevices() {
  return useQuery({
    queryKey: ["user-devices"],
    queryFn: fetchDevices,
    staleTime: 60_000,
  });
}

/** The desktop device (if any) that should flip the rail button to "Open in desktop". */
export function useActiveDesktopDevice(): UserDevice | undefined {
  const { data: devices } = useDevices();
  if (!devices?.length) return undefined;
  return pickActiveDesktopDevice(devices, Date.now(), RECENT_DEVICE_WINDOW_MS);
}
