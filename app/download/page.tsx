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
 * Public download landing — invite emails often open here first. Uses the same
 * Spectra / glass language as sign-in so the first impression matches TEMPO.
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
    <div className="relative flex min-h-screen flex-col md:flex-row" data-lf-chrome>
      <IntroPreload />

      <div className="relative z-10 flex flex-1 items-start justify-center overflow-y-auto px-6 py-10 sm:px-10 md:items-center md:py-14">
        <div className="flex w-full max-w-xl flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-text-hi">
              <Wordmark size={28} />
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </header>

          <section className="glass-hero prism-edge space-y-5 p-6 sm:p-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber">
                You’re invited · download
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-text-hi sm:text-4xl">
                TEMPO on your computer
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-lo">
                Same studio as the web — with the app, your artwork, and every
                bounce kept locally. Install first, then create your account
                inside TEMPO with your invite code.
              </p>
            </div>

            <FlareLine />

            {showOpenDesktop || showUpdateDesktop ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="default" size="lg" className="h-auto py-3">
                  <a href={handoff.href}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <MonitorSmartphone className="size-4" strokeWidth={1.75} />
                      {handoff.label}
                    </span>
                  </a>
                </Button>
                {handoff.secondaryHref ? (
                  <Button asChild variant="secondary" size="lg" className="h-auto py-3">
                    <a href={handoff.secondaryHref}>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Download className="size-4" strokeWidth={1.75} />
                        {handoff.secondaryLabel ?? "Get the installer"}
                      </span>
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {DOWNLOADS.map(({ os: downloadOs, label, fileHint, href }) => (
                  <Button
                    key={downloadOs}
                    asChild
                    variant={os === downloadOs ? "default" : "secondary"}
                    size="lg"
                    className="h-auto flex-col items-start gap-0.5 py-3.5 text-left"
                  >
                    <a href={href}>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Download className="size-4" strokeWidth={1.75} />
                        {label}
                      </span>
                      <span className="font-mono text-xs font-normal text-text-lo/80">
                        {fileHint}
                        {` · v${channelVersion}`}
                        {downloadOs === "mac" && !macReady ? " · publishing soon" : ""}
                      </span>
                    </a>
                  </Button>
                ))}
              </div>
            )}

            <p className="text-xs leading-relaxed text-text-lo/75">
              Prefer the browser for now?{" "}
              <Link href="/register" className="text-ice hover:underline">
                Use the web app
              </Link>{" "}
              with the same invite code — you can install TEMPO any time later.
            </p>
          </section>

          <section className="glass space-y-4 p-6 sm:p-7">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-lo">
              What you get on this machine
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="glass-quiet flex gap-3 p-3.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-input border border-line/70 bg-bg-0/30 text-ice">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-hi">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-lo">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass space-y-3 p-6 sm:p-7">
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
                wizard, then{" "}
                <span className="text-text-hi">More info</span> →{" "}
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

      <div className="relative hidden min-h-[42vh] flex-1 p-4 md:block md:min-h-0">
        <div className="relative h-full min-h-[320px] overflow-hidden rounded-[28px] border border-line/70">
          <LfWindow
            field
            className="absolute inset-0 rounded-[28px]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
