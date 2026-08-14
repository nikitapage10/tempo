"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { signOutOfTempo } from "@/lib/auth/reset-client-session";
import { cn } from "@/lib/utils";

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

  return (
    <button
      type="button"
      onClick={() => {
        if (signingOut) return;
        setSigningOut(true);
        void signOutOfTempo();
      }}
      disabled={signingOut}
      aria-label="Sign out"
      className={cn(
        "fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[90] flex h-9 items-center gap-1.5 rounded-full border border-line bg-bg-2 px-3 text-xs text-text-lo shadow-e3 [-webkit-app-region:no-drag]",
        "transition-opacity duration-[1400ms] ease-out motion-reduce:transition-none",
        "hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        "disabled:cursor-wait disabled:opacity-70",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <LogOut className="size-3.5 shrink-0" strokeWidth={1.75} />
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
