"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageAddAction = "existing" | "new" | "note";

type StageAddMenuProps = {
  stageName: string;
  onAction: (action: StageAddAction) => void;
  className?: string;
};

/**
 * Compact + control for a stage column — opens a short menu to add an
 * existing track with no stage, a new track, or a sticky note into that stage.
 */
export function StageAddMenu({
  stageName,
  onAction,
  className,
}: StageAddMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  );
  const [mounted, setMounted] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const placePanel = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = 180;
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: rect.bottom + 6, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    placePanel();
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t))
        return;
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

  function pick(action: StageAddAction) {
    setOpen(false);
    onAction(action);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={`Add to ${stageName}`}
        aria-label={`Add to ${stageName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "rounded p-0.5 text-ice/80 transition-colors duration-hover",
          "hover:bg-bg-3 hover:text-ice",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          open && "bg-bg-3 text-ice",
          className
        )}
      >
        <Plus className="size-3.5" strokeWidth={2} />
      </button>
      {mounted && open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={`Add to ${stageName}`}
              className="fixed z-[80] w-[180px] rounded-card border border-line bg-bg-1 p-1 shadow-raise"
              style={{ top: pos.top, left: pos.left }}
            >
              {(
                [
                  ["existing", "Existing track…"],
                  ["new", "New track…"],
                  ["note", "Note…"],
                ] as const
              ).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="w-full rounded-[6px] px-2.5 py-1.5 text-left text-xs text-text-hi hover:bg-bg-2"
                  onClick={() => pick(action)}
                >
                  {label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
