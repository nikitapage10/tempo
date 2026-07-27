"use client";

import { ShaderLines } from "@/components/shader-lines";
import { cn } from "@/lib/utils";

type EmptyShaderPanelProps = {
  title: string;
  copy: string;
  action?: React.ReactNode;
  className?: string;
};

/** Contained shader empty state with solid scrim for readable copy (spec §5). */
export function EmptyShaderPanel({
  title,
  copy,
  action,
  className,
}: EmptyShaderPanelProps) {
  return (
    <div
      className={cn(
        "relative h-[300px] overflow-hidden rounded-card border border-line",
        className
      )}
    >
      <div className="absolute inset-0">
        <ShaderLines className="h-full w-full" intensity={1.1} speed={0.85} />
      </div>
      <div className="absolute inset-0 bg-bg-0/85" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flare-line mb-5 w-20" />
        <h2 className="font-display text-lg font-semibold text-text-hi">
          {title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-text-lo">{copy}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
