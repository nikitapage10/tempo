"use client";

import * as React from "react";
import { isDesktopApp } from "@/lib/desktop/bridge";

type ScreenSource = { id: string; name: string; thumbnail: string };

/**
 * TEMPO-styled screen picker for Electron display-capture. Listens for the
 * desktop shell's source list and sends the choice back. Capability-detected:
 * older shells without chooseScreenSource never mount this UI.
 */
export function ScreenSourcePicker() {
  const [sources, setSources] = React.useState<ScreenSource[] | null>(null);

  React.useEffect(() => {
    const desktop = typeof window === "undefined" ? null : window.tempoDesktop;
    if (!isDesktopApp() || typeof desktop?.onScreenSourceRequest !== "function") return;
    return desktop.onScreenSourceRequest((next) => setSources(next));
  }, []);

  if (!sources) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="panel relative z-10 mb-4 w-full max-w-lg p-4 sm:mb-0">
        <h2 className="font-display text-lg font-semibold text-text-hi">Share a screen</h2>
        <p className="mt-1 text-sm text-text-lo">Pick a window or display. The other people on the call will see it.</p>
        <ul className="mt-3 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className="well w-full overflow-hidden p-2 text-left hover:bg-bg-2"
                onClick={() => {
                  void window.tempoDesktop?.chooseScreenSource?.(source.id);
                  setSources(null);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.thumbnail} alt="" className="mb-2 h-20 w-full rounded-input object-cover" />
                <p className="truncate text-xs text-text-hi">{source.name}</p>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 text-sm text-text-lo hover:text-text-hi"
          onClick={() => {
            void window.tempoDesktop?.chooseScreenSource?.(null);
            setSources(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
