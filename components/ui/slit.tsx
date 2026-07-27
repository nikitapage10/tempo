"use client";

import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

/**
 * A 1px rule that is a window onto the Lightfield rather than a flat grey
 * line. Use in place of `border-t border-line` / `h-px bg-line` wherever a
 * divider sits on an opaque surface — it keeps hints of the field visible
 * throughout the app instead of only at the top edge.
 *
 * Not for dividers that sit over body copy; those still need a scrim.
 */
export function SlitDivider({
  className,
  vertical,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <LfWindow
      aria-hidden
      className={cn(
        vertical ? "w-px self-stretch" : "h-px w-full",
        "shrink-0 opacity-70",
        className
      )}
    />
  );
}
