"use client";

import * as React from "react";
import { ChevronDown, LayoutGrid, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type TrackEditMenuProps = {
  onEditLayout: () => void;
  /**
   * Extra entries below the divider — deleting the track, and anything else
   * that changes the track itself rather than how it's arranged.
   */
  extras?: (api: { closeMenu: () => void }) => React.ReactNode;
};

/**
 * The single "Edit" entry point on a track page.
 *
 * Lives in the header rather than in its own toolbar row: as a row it cost a
 * full band of vertical space and pushed every module down for one button.
 */
export function TrackEditMenu({ onEditLayout, extras }: TrackEditMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — a menu that traps you is worse than none.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-input border border-line/80 bg-bg-2/70 px-2.5 py-1.5 text-xs backdrop-blur transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          open ? "text-text-hi" : "text-text-lo hover:text-text-hi",
        )}
      >
        <Pencil className="size-3.5" />
        Edit
        <ChevronDown
          className={cn("size-3 transition-transform duration-hover", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-card border border-line bg-bg-2 py-1 shadow-e3"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-hi transition-colors duration-hover hover:bg-bg-3 focus-visible:bg-bg-3 focus-visible:outline-none"
            onClick={() => {
              setOpen(false);
              onEditLayout();
            }}
          >
            <LayoutGrid className="size-3.5 text-text-lo" />
            Edit layout
          </button>

          {extras ? (
            <>
              <div className="my-1 h-px bg-line" />
              {extras({ closeMenu: () => setOpen(false) })}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
