"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, ExternalLink, MonitorSmartphone, RefreshCw } from "lucide-react";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import { resolveDesktopHandoff } from "@/lib/desktop/handoff";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const WINDOWS_INSTALLER_URL =
  process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL ||
  "/downloads/TEMPO-Setup-0.100.6.exe";

/**
 * Platform handoff shown immediately above Settings in the rail:
 *  - desktop app: "Open web app" in the system browser
 *  - web with a recent registered desktop device: launch TEMPO Desktop
 *  - web with an old desktop device: offer the installer update
 *  - web without one: offer the appropriate desktop download
 */
export function DownloadButton({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const activeDevice = useActiveDesktopDevice();
  const pathname = usePathname();
  // Keep detectOS warm for hydration parity with resolveDesktopHandoff.
  React.useMemo(() => detectOS(), []);

  React.useEffect(() => setMounted(true), []);

  // Avoid a hydration-mismatch flash: platform/device state is client-only.
  if (!mounted) return null;

  const handoff = resolveDesktopHandoff({
    isDesktop: isDesktopApp(),
    pathname,
    activeDevice,
    webAppUrl: getSiteUrl(),
    windowsInstallerUrl: WINDOWS_INSTALLER_URL,
  });

  const Icon =
    handoff.kind === "open-web"
      ? ExternalLink
      : handoff.kind === "open-desktop"
        ? MonitorSmartphone
        : handoff.kind === "update-desktop"
          ? RefreshCw
          : Download;

  return (
    <a
      href={handoff.href}
      target={handoff.kind === "open-web" ? "_blank" : undefined}
      rel={handoff.kind === "open-web" ? "noreferrer" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        className
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {handoff.label}
    </a>
  );
}
