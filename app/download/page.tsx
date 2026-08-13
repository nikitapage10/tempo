"use client";

import * as React from "react";
import Link from "next/link";
import { Download, HardDrive, MonitorSmartphone, RadioTower, Wifi, WifiOff } from "lucide-react";
import { IntroPreload } from "@/components/intro-preload";
import { LfWindow } from "@/components/lf-windows";
import { FlareLine } from "@/components/flare-line";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import {
  resolveDesktopHandoff,
  DESKTOP_WINDOWS_INSTALLER_URL,
  DESKTOP_MAC_DOWNLOAD_URL,
  DESKTOP_SHELL_VERSION,
} from "@/lib/desktop/handoff";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: RadioTower,
    title: "Opens instantly",
    body: "The app lives on your computer — no waiting on a connection just to see your workspace.",
  },
  {
    icon: HardDrive,
    title: "Every bounce, kept",
    body: "Your full version history stays here, not only the newest two the cloud keeps.",
  },
  {
    icon: WifiOff,
    title: "Works offline where it counts",
    body: "Board, Tracks, Projects, Tasks, and Calendar keep going on a plane or bad wifi.",
  },
  {
    icon: Wifi,
    title: "Quiet background sync",
    body: "TEMPO stays current even when it isn’t open, so you’re caught up when you return.",
  },
];

const WINDOWS_INSTALLER_URL = DESKTOP_WINDOWS_INSTALLER_URL;
const MAC_INSTALLER_URL = DESKTOP_MAC_DOWNLOAD_URL;

const DOWNLOADS: {
  os: "windows" | "mac";
  label: string;
  fileHint: string;
  href: string;
}[] = [
  {
    os: "windows",
    label: "Download for Windows",
    fileHint: "Install wizard · about 80 MB",
    href: WINDOWS_INSTALLER_URL,
  },
  {
    os: "mac",
    label: "Download for Mac",
    fileHint: "Universal DMG · about 120 MB",
    href: MAC_INSTALLER_URL,
  },
];

/**
 * Public download landing — invite emails often open here first. Full-bleed
 * Spectra under glass so the frost reads, with download tiles that wrap
 * cleanly instead of overlapping.
 */
export default function DownloadPage() {
  const os = React.useMemo(() => detectOS(), []);
  const [mounted, setMounted] = React.useState(false);
  const [channelVersion, setChannelVersion] = React.useState(DESKTOP_SHELL_VERSION);
  const [macReady, setMacReady] = React.useState(true);
  const activeDevice = useActiveDesktopDevice();

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/desktop/latest", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data.version !== "string") return;
        setChannelVersion(data.version);
        setMacReady(Boolean(data.mac));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handoff = mounted
    ? resolveDesktopHandoff({
        isDesktop: isDesktopApp(),
        pathname: "/download",
        activeDevice,
        webAppUrl: getSiteUrl(),
        windowsInstallerUrl: WINDOWS_INSTALLER_URL,
      })
    : null;

  const showOpenDesktop = handoff?.kind === "open-desktop";
  const showUpdateDesktop = handoff?.kind === "update-desktop";

  return (
    <div className="relative min-h-screen overflow-hidden" data-lf-chrome>
      <IntroPreload />

      {/* Spectra behind the whole page — glass only reads when light shows through. */}
      <LfWindow
        field
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
      {/* Soft dark wash so type stays readable without killing the frost. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-bg-0/55 via-bg-0/35 to-bg-0/60"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-6 py-10 sm:px-10 md:justify-center md:py-14">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-text-hi">
            <Wordmark size={28} />
          </Link>
          <Button asChild variant="ghost" size="sm" className="glass-chip px-3">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>

        <section className="glass-hero prism-edge space-y-5 overflow-hidden p-6 sm:p-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber">
              You’re invited · download
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-text-hi sm:text-4xl">
              TEMPO on your computer
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-lo">
              Same studio as the web — with the app, your artwork, and every
              bounce kept locally. Install first, then create your account
              inside TEMPO with your invite code.
            </p>
          </div>

          <FlareLine />

          {showOpenDesktop || showUpdateDesktop ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={handoff.href}
                className="inline-flex h-auto items-center justify-center gap-2 rounded-input bg-ice px-5 py-3 text-sm font-medium text-bg-0 transition-colors duration-hover hover:bg-ice/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <MonitorSmartphone className="size-4 shrink-0" strokeWidth={1.75} />
                {handoff.label}
              </a>
              {handoff.secondaryHref ? (
                <a
                  href={handoff.secondaryHref}
                  className="glass-quiet inline-flex h-auto items-center justify-center gap-2 rounded-input px-5 py-3 text-sm font-medium text-text-hi transition-colors duration-hover hover:bg-bg-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  <Download className="size-4 shrink-0" strokeWidth={1.75} />
                  {handoff.secondaryLabel ?? "Get the installer"}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {DOWNLOADS.map(({ os: downloadOs, label, fileHint, href }) => {
                const preferred = os === downloadOs;
                return (
                  <a
                    key={downloadOs}
                    href={href}
                    className={cn(
                      "glass-quiet flex min-w-0 flex-col items-start gap-1.5 rounded-panel p-4 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                      preferred
                        ? "border-ice/35 bg-ice/12 hover:bg-ice/18"
                        : "hover:bg-bg-2/35"
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-text-hi">
                      <Download
                        className={cn("size-4 shrink-0", preferred && "text-ice")}
                        strokeWidth={1.75}
                      />
                      {label}
                    </span>
                    <span className="w-full whitespace-normal break-words font-mono text-[11px] leading-snug text-text-lo/85">
                      {fileHint}
                      {` · v${channelVersion}`}
                      {downloadOs === "mac" && !macReady ? " · publishing soon" : ""}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          <p className="text-xs leading-relaxed text-text-lo/80">
            Prefer the browser for now?{" "}
            <Link href="/register" className="text-ice hover:underline">
              Use the web app
            </Link>{" "}
            with the same invite code — you can install TEMPO any time later.
          </p>
        </section>

        <section className="glass space-y-4 overflow-hidden p-6 sm:p-7">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-lo">
            What you get on this machine
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass-quiet flex min-w-0 gap-3 p-3.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-input border border-line/50 bg-bg-0/25 text-ice">
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-hi">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-lo">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass space-y-3 overflow-hidden p-6 sm:p-7">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-lo">
            Beta install notice
          </h2>
          <p className="text-sm leading-relaxed text-text-lo">
            These builds aren’t code-signed yet, so your OS will warn you
            before the first run — expected for this beta, not a broken
            download.
          </p>
          <ul className="space-y-1.5 text-sm text-text-lo">
            <li>
              <span className="text-text-hi">Windows:</span> run the setup
              wizard, then <span className="text-text-hi">More info</span> →{" "}
              <span className="text-text-hi">Run anyway</span> if SmartScreen
              warns.
            </li>
            <li>
              <span className="text-text-hi">Mac:</span> right-click the app
              (or DMG), choose <span className="text-text-hi">Open</span>, and
              confirm Open again.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
