"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { signOutOfTempo } from "@/lib/auth/reset-client-session";
import { prefersReducedMotion } from "@/lib/origin/readiness";
import { cn } from "@/lib/utils";

/**
 * After Tune in, the awaken copy still has 900ms to clear and the opening
 * has to take the frame. Chrome waits out that beat, then fades — never in
 * the same motion as the film or the first line.
 */
export const ONBOARDING_CHROME_REVEAL_DELAY_MS = 2800;
export const ONBOARDING_CHROME_FADE_IN_MS = 2000;
export const ONBOARDING_CHROME_FADE_OUT_MS = 700;

/** Delays a true `visible` so Origin/Passage chrome does not arrive with Tune in. */
export function useOnboardingChromeReveal(visible: boolean): boolean {
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setRevealed(false);
      return;
    }
    const delay = prefersReducedMotion() ? 0 : ONBOARDING_CHROME_REVEAL_DELAY_MS;
    if (delay <= 0) {
      setRevealed(true);
      return;
    }
    const id = window.setTimeout(() => setRevealed(true), delay);
    return () => window.clearTimeout(id);
  }, [visible]);

  return revealed;
}

/**
 * The way out of ORIGIN before an artist has committed to it.
 *
 * ORIGIN is a full-screen takeover with no rail, no back button, and (on
 * desktop) no browser chrome to fall back on — without this, the only way
 * out once the film is running is force-quitting the app. Held back until
 * the opening line has played (`visible`, same gate as the zoom control) so
 * it never competes with the very first moment.
 */
export function OriginExitControl({ visible }: { visible: boolean }) {
  const [signingOut, setSigningOut] = React.useState(false);
  const revealed = useOnboardingChromeReveal(visible);

  return (
    <button
      type="button"
      onClick={() => {
        if (signingOut) return;
        setSigningOut(true);
        void signOutOfTempo();
      }}
      disabled={signingOut}
      aria-hidden={!revealed}
      tabIndex={revealed ? undefined : -1}
      aria-label="Sign out"
      className={cn(
        "fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[90] flex h-9 items-center gap-1.5 rounded-full border border-line bg-bg-2 px-3 text-xs text-text-lo shadow-e3 [-webkit-app-region:no-drag]",
        "transition-opacity ease-out motion-reduce:transition-none",
        "hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        "disabled:cursor-wait disabled:opacity-70",
        revealed ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      style={{
        transitionDuration: `${revealed ? ONBOARDING_CHROME_FADE_IN_MS : ONBOARDING_CHROME_FADE_OUT_MS}ms`,
      }}
    >
      <LogOut className="size-3.5 shrink-0" strokeWidth={1.75} />
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
