"use client";

import type * as React from "react";

import { SlitDivider } from "@/components/ui/slit";

/**
 * One labelled row of filter chips inside a filter bar.
 *
 * The label sits in a fixed-width column so stacked rows line up instead of
 * each starting at a different x — that misalignment is most of what made the
 * old filter area read as scattered.
 */
export function FilterRow({
  label,
  children,
  trailing,
  divider,
}: {
  label: string;
  children: React.ReactNode;
  /** Right-aligned slot — e.g. a "Clear filters" action. */
  trailing?: React.ReactNode;
  /** Draw a lightfield slit above this row (use on all but the first). */
  divider?: boolean;
}) {
  return (
    <>
      {divider ? <SlitDivider /> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap">
        <span className="label-mono w-12 shrink-0">{label}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {children}
        </div>
        {trailing}
      </div>
    </>
  );
}
