"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, ExternalLink, MonitorSmartphone, RefreshCw } from "lucide-react";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import { resolveDesktopHandoff, DESKTOP_WINDOWS_INSTALLER_URL } from "@/lib/desktop/handoff";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

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
    windowsInstallerUrl: DESKTOP_WINDOWS_INSTALLER_URL,
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
      title={handoff.label}
      aria-label={handoff.label}
      className={cn(
        "flex items-center justify-center gap-2.5 rounded-input px-2 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice xl:justify-start xl:px-3",
        className
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="hidden xl:inline">{handoff.label}</span>
    </a>
  );
}
