"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Globe } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { isDesktopApp } from "@/lib/desktop/bridge";
import {
  DESKTOP_WINDOWS_INSTALLER_URL,
  DESKTOP_MAC_DOWNLOAD_URL,
} from "@/lib/desktop/handoff";
import { detectOS } from "@/lib/platform";
import { completePlatformInvite } from "@/lib/auth/complete-platform-invite";

const WINDOWS_INSTALLER_URL = DESKTOP_WINDOWS_INSTALLER_URL;
const MAC_INSTALLER_URL = DESKTOP_MAC_DOWNLOAD_URL;

/**
 * Post-invite chooser — after creating an account from an invite, pick how to
 * use TEMPO before Origin begins. Outside (app) so unfinished Origin does not
 * bounce the artist away; outside (onboarding) so ActiveArtist is not required yet.
 */
export default function WelcomePage() {
  return (
    <React.Suspense
      fallback={
        <AuthShell>
          <div className="h-40 animate-pulse rounded-panel bg-bg-2/40" />
        </AuthShell>
      }
    >
      <WelcomeChooser />
    </React.Suspense>
  );
}

function WelcomeChooser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite")?.trim() ?? "";
  const [mounted, setMounted] = React.useState(false);
  const [inviteReady, setInviteReady] = React.useState(!inviteCode);
  const os = React.useMemo(() => detectOS(), []);

  React.useEffect(() => {
    setMounted(true);
    if (!inviteCode) {
      if (isDesktopApp()) router.replace("/origin");
      return;
    }
    let cancelled = false;
    void completePlatformInvite(inviteCode)
      .then((result) => {
        if (cancelled) return;
        setInviteReady(true);
        if (result.startPassage) {
          router.replace("/passage");
          return;
        }
        if (isDesktopApp() || result.startOrigin) {
          if (isDesktopApp()) router.replace("/origin");
          return;
        }
        router.replace("/");
      })
      .catch(() => {
        if (cancelled) return;
        setInviteReady(true);
        if (isDesktopApp()) router.replace("/origin");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode, router]);

  if (!mounted || !inviteReady) {
    return (
      <AuthShell>
        <div className="h-40 animate-pulse rounded-panel bg-bg-2/40" />
      </AuthShell>
    );
  }

  if (isDesktopApp()) return null;

  const preferMac = os === "mac";
  const desktopHref = preferMac ? MAC_INSTALLER_URL : WINDOWS_INSTALLER_URL;
  const desktopLabel = preferMac ? "Download for Mac" : "Download for Windows";
  const desktopHint = preferMac
    ? "Unsigned universal build — right-click → Open the first time Gatekeeper warns."
    : "Install the desktop app, then come back to finish Origin in either place.";

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">
            You’re in. How do you want to use TEMPO?
          </p>
        </div>

        <div className="grid gap-3">
          <Button asChild variant="default" size="lg" className="h-auto justify-start gap-3 py-4 text-left">
            <Link href="/origin">
              <Globe className="size-5 shrink-0" strokeWidth={1.75} />
              <span>
                <span className="block text-sm font-medium">Continue in the browser</span>
                <span className="mt-0.5 block text-xs font-normal text-text-lo/80">
                  Start Origin here — you can install desktop any time from Settings.
                </span>
              </span>
            </Link>
          </Button>

          <Button asChild variant="secondary" size="lg" className="h-auto justify-start gap-3 py-4 text-left">
            <a href={desktopHref}>
              <Download className="size-5 shrink-0" strokeWidth={1.75} />
              <span>
                <span className="block text-sm font-medium">{desktopLabel}</span>
                <span className="mt-0.5 block text-xs font-normal text-text-lo/80">
                  {desktopHint}
                </span>
              </span>
            </a>
          </Button>
        </div>

        <p className="text-xs text-text-lo/70">
          After the installer finishes, open TEMPO and sign in with the
          same account — or keep going in the browser with{" "}
          <Link href="/origin" className="text-ice hover:underline">
            Continue in the browser
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
