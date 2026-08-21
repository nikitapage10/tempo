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

const DEFERRED_FOR_SESSION_KEY = "tempo:update-deferred-for-session";

/**
 * Desktop-only prompt when a new native shell installer is downloaded and ready.
 * Ordinary web/UI deploys do not use this bar — the Electron window loads the live
 * site, so a page change picks those up without a reinstall.
 */
export function DesktopUpdateBanner() {
  const [mounted, setMounted] = React.useState(false);
  const [nativeUpdateReady, setNativeUpdateReady] = React.useState(false);
  const [deferred, setDeferred] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);

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

    return () => {
      active = false;
      unsubscribe();
    };
  }, [mounted]);

  async function updateNow() {
    setUpdating(true);
    const started = await installDesktopUpdate();
    if (!started) setUpdating(false);
  }

  function deferForSession() {
    sessionStorage.setItem(DEFERRED_FOR_SESSION_KEY, "true");
    setDeferred(true);
  }

  if (!mounted || !isDesktopApp() || deferred || !nativeUpdateReady) {
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
          <p className="text-sm font-medium text-text-hi">A TEMPO app update is ready.</p>
          <p className="mt-0.5 text-xs text-text-lo">
            Install it to get the latest desktop app. Everyday site updates arrive on their own when you move around TEMPO.
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
