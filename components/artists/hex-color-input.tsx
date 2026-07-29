"use client";

import * as React from "react";
import { normalizeHexColor } from "@/lib/artist-theme";
import { cn } from "@/lib/utils";

/**
 * Tiny native color chip — opens the OS colour slider / picker.
 * Commits on change (browsers fire this as the user drags / closes).
 */
export function HexColorInput({
  value,
  fallback,
  onCommit,
  ariaLabel,
  className,
  title,
}: {
  value: string;
  fallback: string;
  onCommit: (hex: string) => void;
  ariaLabel: string;
  className?: string;
  title?: string;
}) {
  const hex = normalizeHexColor(value, fallback);

  return (
    <label
      className={cn(
        "relative inline-flex size-5 cursor-pointer overflow-hidden rounded-[4px] border border-line transition-colors duration-hover hover:border-text-lo",
        className
      )}
      title={title ?? ariaLabel}
    >
      <span
        className="absolute inset-0"
        style={{ background: hex }}
        aria-hidden
      />
      <input
        type="color"
        value={hex}
        aria-label={ariaLabel}
        onChange={(e) =>
          onCommit(normalizeHexColor(e.target.value, fallback))
        }
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
