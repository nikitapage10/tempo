"use client";

import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

type EmptyShaderPanelProps = {
  title: string;
  copy: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Empty state as a Lightfield window + ≥85% black scrim + directive copy.
 */
export function EmptyShaderPanel({
  title,
  copy,
  action,
  className,
}: EmptyShaderPanelProps) {
  return (
    <LfWindow
      className={cn(
        "relative h-[300px] overflow-hidden rounded-card border border-line",
        className
      )}
    >
      <div className="lf-window-scrim absolute inset-0" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <FlareLine variant="tick" className="mb-5 !w-20" />
        <h2 className="font-display text-lg font-semibold text-text-hi">
          {title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-text-lo">{copy}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </LfWindow>
  );
}
