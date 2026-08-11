"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDesktopUpdateState,
  installDesktopUpdate,
  isDesktopApp,
  onDesktopUpdateStateChange,
} from "@/lib/desktop/bridge";
import { APP_VERSION } from "@/lib/version";

const WEB_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFERRED_FOR_SESSION_KEY = "tempo:update-deferred-for-session";

type BuildResponse = {
  buildId?: string;
  version?: string;
};

/**
 * One calm, desktop-only prompt for both kinds of TEMPO delivery: a new web
 * deployment or a downloaded native shell. The difference stays internal so
 * the person using TEMPO only has one update decision to make.
 */
export function DesktopUpdateBanner() {
  const [mounted, setMounted] = React.useState(false);
  const [nativeUpdateReady, setNativeUpdateReady] = React.useState(false);
  const [webUpdateReady, setWebUpdateReady] = React.useState(false);
  const [deferred, setDeferred] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const initialBuildId = React.useRef<string | null>(null);
  const webCheckInFlight = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
    setDeferred(sessionStorage.getItem(DEFERRED_FOR_SESSION_KEY) === "true");
  }, []);

  React.useEffect(() => {
    if (!mounted || !isDesktopApp()) return;

    let active = true;

    void getDesktopUpdateState().then((state) => {
      if (active) setNativeUpdateReady(state.ready);
    });

    const unsubscribe = onDesktopUpdateStateChange((state) => {
      if (active) setNativeUpdateReady(state.ready);
    });

    async function checkWebBuild() {
      if (webCheckInFlight.current) return;
      webCheckInFlight.current = true;

      try {
        const response = await fetch(`/api/app-build?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const result = (await response.json()) as BuildResponse;
        if (!result.buildId) return;

        // This also catches an update if the first network check happens only
        // after a deployment: APP_VERSION belongs to the renderer already on
        // screen, while result.version belongs to the server now online.
        if (result.version && result.version !== APP_VERSION && active) {
          setWebUpdateReady(true);
        }

        if (initialBuildId.current === null) {
          initialBuildId.current = result.buildId;
        } else if (initialBuildId.current !== result.buildId && active) {
          setWebUpdateReady(true);
        }
      } catch {
        // An update check should never interrupt work or create an error toast.
      } finally {
        webCheckInFlight.current = false;
      }
    }

    function checkWhenVisible() {
      if (document.visibilityState === "visible") void checkWebBuild();
    }

    void checkWebBuild();
    const interval = window.setInterval(checkWebBuild, WEB_UPDATE_CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkWebBuild);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", checkWebBuild);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [mounted]);

  async function updateNow() {
    setUpdating(true);

    if (nativeUpdateReady) {
      const started = await installDesktopUpdate();
      if (started) return;
    }

    window.location.reload();
  }

  function deferForSession() {
    sessionStorage.setItem(DEFERRED_FOR_SESSION_KEY, "true");
    setDeferred(true);
  }

  if (
    !mounted ||
    !isDesktopApp() ||
    deferred ||
    (!nativeUpdateReady && !webUpdateReady)
  ) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-ice/30 bg-ice/5 px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice">
          <RefreshCw className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-hi">A TEMPO update is available.</p>
          <p className="mt-0.5 text-xs text-text-lo">
            Update now to get the latest improvements.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={() => void updateNow()} disabled={updating}>
          Update now
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={deferForSession}
          disabled={updating}
        >
          After this session
        </Button>
      </div>
    </div>
  );
}
