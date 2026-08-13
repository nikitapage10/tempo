"use client";

import * as React from "react";
import { LfWindow } from "@/components/lf-windows";

/** Section label with a slit onto the light field running out from it. */
export function SectionHeader({
  label,
  count,
  aside,
}: {
  label: string;
  count?: number;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="label-mono">{label}</h2>
      {count !== undefined && count > 0 ? (
        <span className="font-mono text-xs tabular-nums text-text-lo/70">
          {count}
        </span>
      ) : null}
      <LfWindow className="h-px flex-1 opacity-80" aria-hidden />
      {aside}
    </div>
  );
}

export function QuietEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="well px-4 py-8 text-center">
      <p className="mx-auto max-w-[38ch] text-sm text-text-lo">{children}</p>
    </div>
  );
}
