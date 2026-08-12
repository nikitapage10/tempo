"use client";

import * as React from "react";
import { Download, HardDrive, RadioTower, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { detectOS } from "@/lib/platform";

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

// Until the public binary-only release channel has its first verified release,
// keep serving the bundled beta from the app's own domain. Once Vercel's
// NEXT_PUBLIC_DESKTOP_WINDOWS_URL points at the public channel's stable
// latest-download URL, future desktop releases require no web code change.
const WINDOWS_INSTALLER_URL =
  process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL ||
  "/downloads/TEMPO-Setup-0.100.6.exe";

const DOWNLOADS: {
  os: "windows" | "mac";
  label: string;
  fileHint: string;
  href: string | null;
}[] = [
  {
    os: "windows",
    label: "Download for Windows",
    fileHint: "Windows installer · about 80 MB",
    href: WINDOWS_INSTALLER_URL,
  },
  {
    os: "mac",
    label: "Download for Mac",
    fileHint: "Not built yet — needs a Mac",
    href: null,
  },
];

export default function DownloadPage() {
  const os = React.useMemo(() => detectOS(), []);

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

        <div className="grid gap-3 sm:grid-cols-2">
          {DOWNLOADS.map(({ os: downloadOs, label, fileHint, href }) =>
            href ? (
              <Button
                key={downloadOs}
                asChild
                variant={os === downloadOs ? "default" : "secondary"}
                size="lg"
                className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              >
                <a href={href} download>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Download className="size-4" strokeWidth={1.75} />
                    {label}
                  </span>
                  <span className="font-mono text-xs font-normal text-text-lo/80">
                    {fileHint}
                  </span>
                </a>
              </Button>
            ) : (
              <Button
                key={downloadOs}
                variant="secondary"
                size="lg"
                className="h-auto flex-col items-start gap-0.5 py-3 text-left"
                disabled
                title="A Mac build has to be built on a Mac — it isn’t available yet."
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Download className="size-4" strokeWidth={1.75} />
                  {label}
                </span>
                <span className="font-mono text-xs font-normal text-text-lo/80">
                  {fileHint}
                </span>
              </Button>
            )
          )}
        </div>
        <p className="text-xs text-text-lo/70">
          Windows is a real, unsigned beta build — see the install notice
          below before you run it. The Mac build needs to be built on a Mac
          and isn’t up yet.
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
          This build isn’t code-signed yet, so Windows will warn you before
          the first run — this is expected, not a sign anything’s wrong.
        </p>
        <ul className="space-y-1.5 text-sm text-text-lo">
          <li>
            <span className="text-text-hi">Windows:</span> click{" "}
            <span className="text-text-hi">More info</span>, then{" "}
            <span className="text-text-hi">Run anyway</span> on the SmartScreen
            prompt.
          </li>
        </ul>
      </section>
    </div>
  );
}
