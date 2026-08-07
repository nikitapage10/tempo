"use client";

import { Chip } from "@/components/ui/chip";
import type { SceneRsvpResponse } from "@/lib/types";

const OPTIONS: { value: SceneRsvpResponse; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "interested", label: "Interested" },
  { value: "not_going", label: "Can't go" },
];

export function RsvpControl({
  value,
  disabled,
  full,
  onChange,
}: {
  value: SceneRsvpResponse | null | undefined;
  disabled?: boolean;
  /** Capacity is full and the caller hasn't already RSVP'd going. */
  full?: boolean;
  onChange: (response: SceneRsvpResponse) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => (
        <Chip
          key={opt.value}
          active={value === opt.value}
          onClick={
            disabled || (full && opt.value === "going" && value !== "going")
              ? undefined
              : () => onChange(opt.value)
          }
          className={
            disabled || (full && opt.value === "going" && value !== "going")
              ? "opacity-50"
              : undefined
          }
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
