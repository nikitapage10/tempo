"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, ExternalLink, MonitorSmartphone } from "lucide-react";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const DESKTOP_LINK_MIN_VERSION = [0, 100, 9] as const;

function supportsDesktopLink(version: string): boolean {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return DESKTOP_LINK_MIN_VERSION.every((minimum, index) => {
    const current = Number.isFinite(parts[index]) ? parts[index] : 0;
    const earlierPartsMatch = DESKTOP_LINK_MIN_VERSION
      .slice(0, index)
      .every((part, earlierIndex) => (parts[earlierIndex] ?? 0) === part);
    return !earlierPartsMatch || current >= minimum;
  });
}

/**
 * Platform handoff shown immediately above Settings in the rail:
 *  - desktop app: "Open web app" in the system browser
 *  - web with a recent registered desktop device: launch TEMPO Desktop
 *  - web without one: offer the appropriate desktop download
 */
export function DownloadButton({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const os = React.useMemo(() => detectOS(), []);
  const activeDevice = useActiveDesktopDevice();
  const pathname = usePathname();

  React.useEffect(() => setMounted(true), []);

  // Avoid a hydration-mismatch flash: platform/device state is client-only.
  if (!mounted) return null;

  const desktop = isDesktopApp();
  // A recent pre-0.100.9 install has no tempo:// handler. Keep offering its
  // installer/update instead of rendering an action the browser cannot open.
  const canOpenDesktop = Boolean(
    activeDevice && supportsDesktopLink(activeDevice.app_version)
  );

  const label = desktop
    ? "Open web app"
    : canOpenDesktop
      ? "Open in desktop"
      : os === "mac"
        ? "Download for Mac"
        : os === "windows"
          ? "Download for Windows"
          : "Download for desktop";

  const Icon = desktop ? ExternalLink : canOpenDesktop ? MonitorSmartphone : Download;
  const href = desktop
    ? `${getSiteUrl()}${pathname}`
    : canOpenDesktop
      ? `tempo://open?path=${encodeURIComponent(pathname)}`
      : "/download";

  return (
    <a
      href={href}
      target={desktop ? "_blank" : undefined}
      rel={desktop ? "noreferrer" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        className
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {label}
    </a>
  );
}
