"use client";

import * as React from "react";
import Link from "next/link";
import { Download, MonitorSmartphone } from "lucide-react";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { cn } from "@/lib/utils";

/**
 * Top-left counterpart to the top-right search bar (components/app-shell.tsx).
 * Three states, per planning/desktop/01-PRODUCT-AND-UX-SPEC.md:
 *  - running inside the desktop app itself: renders nothing
 *  - a recent desktop device is registered on this account: "Open in desktop"
 *  - otherwise: "Download for Windows/Mac", linking to /download
 * "Open in desktop" can't actually launch a native app from a web page
 * without a registered protocol handler (a later package), so for now it
 * takes the artist to /download, which explains that plainly.
 */
export function DownloadButton({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const os = React.useMemo(() => detectOS(), []);
  const activeDevice = useActiveDesktopDevice();

  React.useEffect(() => setMounted(true), []);

  // Avoid a hydration-mismatch flash: platform/device state is client-only.
  if (!mounted || isDesktopApp()) return null;

  const label = activeDevice
    ? "Open in desktop"
    : os === "mac"
      ? "Download for Mac"
      : os === "windows"
        ? "Download for Windows"
        : "Download for desktop";

  const Icon = activeDevice ? MonitorSmartphone : Download;

  return (
    <Link
      href="/download"
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-input border border-line/60 bg-bg-1 px-3 text-xs text-text-lo/60 transition-colors duration-hover hover:border-line hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        className
      )}
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
      {label}
    </Link>
  );
}
