"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type PanelPos = { top: number; left: number; width: number };

/**
 * Compact header control that opens a floating panel portaled to document.body
 * so it never stretches the actions row or gets clipped by page overflow.
 */
export function HeaderMenu({
  label,
  summary,
  active,
  onClear,
  children,
  className,
  /** Wider panel for filter chip grids. */
  panelWidth = 280,
}: {
  label: string;
  /** Short hint when active — prefer a count or single word, not a long list. */
  summary?: string | null;
  active?: boolean;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
  panelWidth?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<PanelPos | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const placePanel = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(panelWidth, window.innerWidth - 16);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = rect.bottom + 6;
    setPos({ top, left, width });
  }, [panelWidth]);

  React.useEffect(() => {
    if (!open) return;
    placePanel();
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placePanel();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placePanel]);

  const panel =
    open && mounted && pos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: "min(70vh, 28rem)",
            }}
            className={cn(
              "z-[80] overflow-y-auto rounded-card border border-line bg-bg-1 p-3 shadow-e2"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="label-mono text-[11px] text-text-lo/70">
                {label}
              </span>
              {active && onClear ? (
                <button
                  type="button"
                  onClick={() => onClear()}
                  className="text-xs text-ice hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-3">{children}</div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-input border px-2.5 text-xs transition-colors duration-hover",
          open || active
            ? "border-ice/40 bg-ice/10 text-ice"
            : "border-line bg-bg-2/60 text-text-lo hover:text-text-hi"
        )}
      >
        <span className="whitespace-nowrap">
          {label}
          {active && summary ? (
            <span className="font-normal text-ice/80"> · {summary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-70 transition-transform duration-hover",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
