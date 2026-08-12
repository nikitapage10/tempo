"use client";

import * as React from "react";
import { Download, HardDrive, MonitorSmartphone, RadioTower, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import {
  resolveDesktopHandoff,
  DESKTOP_WINDOWS_INSTALLER_URL,
  DESKTOP_MAC_INSTALLER_URL,
} from "@/lib/desktop/handoff";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";

const HIGHLIGHTS = [
  {
    icon: RadioTower,
    title: "Opens instantly",
    body: "The app itself lives on your computer, so there's no waiting on a connection just to see your workspace.",
  },
  {
    icon: HardDrive,
    title: "Your whole bounce history, kept",
    body: "Every version you've ever uploaded stays on this computer — not just the newest two the cloud keeps.",
  },
  {
    icon: WifiOff,
    title: "Works on Board, Tracks, Projects, Tasks, and Calendar offline",
    body: "Keep working on a plane or with bad wifi. Everything else needs a connection, same as today.",
  },
  {
    icon: Wifi,
    title: "Syncs quietly in the background",
    body: "TEMPO keeps itself current even when it isn't open, so it's already caught up by the time you get to it.",
  },
];

// NEXT_PUBLIC_DESKTOP_WINDOWS_URL / NEXT_PUBLIC_DESKTOP_MAC_URL override the
// defaults when the public GitHub release channel is live.
const WINDOWS_INSTALLER_URL = DESKTOP_WINDOWS_INSTALLER_URL;
const MAC_INSTALLER_URL = DESKTOP_MAC_INSTALLER_URL;

const DOWNLOADS: {
  os: "windows" | "mac";
  label: string;
  fileHint: string;
  href: string;
}[] = [
  {
    os: "windows",
    label: "Download for Windows",
    fileHint: "Windows wizard installer · about 80 MB",
    href: WINDOWS_INSTALLER_URL,
  },
  {
    os: "mac",
    label: "Download for Mac",
    fileHint: "Unsigned universal DMG · about 120 MB",
    href: MAC_INSTALLER_URL,
  },
];

export default function DownloadPage() {
  const os = React.useMemo(() => detectOS(), []);
  const [mounted, setMounted] = React.useState(false);
  const activeDevice = useActiveDesktopDevice();

  React.useEffect(() => setMounted(true), []);

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
    <div className="w-full space-y-6">
      <PageHeader
        title="TEMPO Desktop"
        subtitle="A downloadable version of TEMPO for Windows and Mac."
      />

      <section className="panel space-y-4 p-6 sm:p-8">
        <p className="text-sm leading-relaxed text-text-lo">
          Everything about TEMPO works exactly the same — every setting, every
          permission, every feature — while connected to the internet. What’s
          different is what stays on your computer: the app itself, your
          artwork, and a complete local copy of every bounce you’ve ever
          uploaded.
        </p>

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
                <a href={handoff.secondaryHref} download={showUpdateDesktop || undefined}>
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
                className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              >
                <a href={href} download={downloadOs === "windows" || undefined}>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Download className="size-4" strokeWidth={1.75} />
                    {label}
                  </span>
                  <span className="font-mono text-xs font-normal text-text-lo/80">
                    {fileHint}
                  </span>
                </a>
              </Button>
            ))}
          </div>
        )}
        <p className="text-xs text-text-lo/70">
          Windows uses a short install wizard (welcome, folder, shortcuts). Both
          builds are unsigned betas — see the install notice below before you
          open them. Mac is a universal app (Apple Silicon and Intel).
        </p>
      </section>

      <section className="panel space-y-4 p-6 sm:p-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          What the desktop app adds
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-input border border-line bg-bg-2/60 text-ice">
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

      <section className="panel space-y-3 p-6 sm:p-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          Beta install notice
        </h2>
        <p className="text-sm leading-relaxed text-text-lo">
          These builds aren’t code-signed yet, so your OS will warn you before
          the first run — this is expected, not a sign anything’s wrong.
        </p>
        <ul className="space-y-1.5 text-sm text-text-lo">
          <li>
            <span className="text-text-hi">Windows:</span> run the setup wizard,
            pick a folder if you like, then click{" "}
            <span className="text-text-hi">More info</span> →{" "}
            <span className="text-text-hi">Run anyway</span> if SmartScreen
            warns (unsigned beta).
          </li>
          <li>
            <span className="text-text-hi">Mac:</span> if macOS says the app
            can’t be opened, right-click the app (or the DMG icon), choose{" "}
            <span className="text-text-hi">Open</span>, then confirm{" "}
            <span className="text-text-hi">Open</span> again. You can also allow
            it under System Settings → Privacy &amp; Security.
          </li>
        </ul>
      </section>
    </div>
  );
}
