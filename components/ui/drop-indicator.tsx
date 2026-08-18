"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { DropSlot } from "@/lib/dnd/drop-slot";
import { dropSlotId } from "@/lib/dnd/drop-slot";

export function DropIndicator({
  slot,
  active,
  disabled,
  edge = "before",
}: {
  slot: DropSlot;
  active: boolean;
  disabled?: boolean;
  edge?: "before" | "end";
}) {
  const id = dropSlotId(slot);
  const { setNodeRef } = useDroppable({
    id,
    disabled,
    data: { slot, containerId: slot.containerId },
  });

  return (
    <div
      ref={setNodeRef}
      data-drop-slot={id}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 h-6",
        edge === "end" ? "top-0" : "-top-3",
        disabled && "pointer-events-none"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ice shadow-[0_0_10px_color-mix(in_srgb,var(--ice)_70%,transparent)] transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

/** Keeps the ice line out of document flow so showing/hiding it does not shift cards. */
export function InsertSlot({
  show,
  slot,
  active,
  disabled,
  children,
}: {
  show?: boolean;
  slot: DropSlot;
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <DropIndicator
        slot={slot}
        active={Boolean(show) && active}
        disabled={!show || disabled}
      />
      {children}
    </div>
  );
}

export function InsertEnd({
  show,
  slot,
  active,
  disabled,
}: {
  show?: boolean;
  slot: DropSlot;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative h-0">
      <DropIndicator
        slot={slot}
        active={Boolean(show) && active}
        disabled={!show || disabled}
        edge="end"
      />
    </div>
  );
}
