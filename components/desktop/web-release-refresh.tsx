"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { APP_VERSION } from "@/lib/version";

const RELEASE_CHECK_MS = 2 * 60_000;

type AppBuild = {
  version?: string;
};

/**
 * The desktop shell renders the live web app, but a tab that stays open keeps
 * its current JavaScript until it reloads. Detect a newer product build and
 * refresh only when the artist returns to the window or changes pages.
 */
export function DesktopWebReleaseRefresh() {
  const pathname = usePathname();
  const checkRef = React.useRef<((mayReload: boolean) => Promise<void>) | null>(
    null
  );

  React.useEffect(() => {
    if (!isDesktopApp()) return;

    let active = true;
    let stale = false;
    let reloading = false;

    const check = async (mayReload: boolean) => {
      if (!active || reloading) return;
      try {
        const response = await fetch(`/api/app-build?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const build = (await response.json()) as AppBuild;
        if (build.version && build.version !== APP_VERSION) stale = true;
        if (stale && mayReload) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        // Offline or mid-deploy: the next interval/focus will try again.
      }
    };

    checkRef.current = check;
    void check(false);
    const interval = window.setInterval(() => void check(false), RELEASE_CHECK_MS);
    const onFocus = () => void check(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      checkRef.current = null;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  React.useEffect(() => {
    void checkRef.current?.(true);
  }, [pathname]);

  return null;
}
