"use client";

import { IntroMoment } from "@/components/intro-moment";
import { LfWindow } from "@/components/lf-windows";

/**
 * Shared two-column shell for /login and /register.
 *
 * The lightfield chrome is solid `#0A0A0C` everywhere by default (the same
 * value as --bg-0) until something registers a window — so the left column
 * needs no painted background of its own. The right column punches exactly
 * one rounded window, scoped to its own inset card, so the shader is visible
 * full-strength inside that card only. No scrim, no gradient, no imagery —
 * the shader the app already runs is the whole point of the card.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col md:flex-row" data-lf-chrome>
      <IntroMoment />

      <div className="flex flex-1 items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="hidden flex-1 p-4 md:block">
        <div className="relative h-full overflow-hidden rounded-[28px] border border-line">
          <LfWindow className="absolute inset-0 rounded-[28px]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
