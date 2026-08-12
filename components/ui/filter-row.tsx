"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { SlitDivider } from "@/components/ui/slit";
import { cn } from "@/lib/utils";

/**
 * One labelled row of filter chips inside a filter bar (legacy stacked layout).
 * Prefer FilterToolbar + FilterGroup for Board / Tracks.
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5 sm:flex-nowrap">
        <span className="label-mono w-10 shrink-0 text-[11px]">{label}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {children}
        </div>
        {trailing}
      </div>
    </>
  );
}

/** Compact labelled chip cluster for an inline filter toolbar. */
export function FilterGroup({
  label,
  children,
  className,
  /** Label above chips — better inside floating menus. */
  stacked,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <span className="label-mono text-[11px] text-text-lo/70">{label}</span>
        <div className="flex flex-wrap gap-1">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1",
        className
      )}
    >
      <span className="label-mono shrink-0 text-[11px] text-text-lo/70">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Dense single-panel filter/sort toolbar. Groups wrap on one continuous
 * surface instead of stacking full-width rows with slit dividers.
 */
export function FilterToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel-quiet flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Thin vertical rule between toolbar groups (hidden when the wrap breaks). */
export function FilterSep() {
  return (
    <span
      aria-hidden
      className="hidden h-3 w-px shrink-0 self-center bg-line sm:block"
    />
  );
}

/**
 * Collapsible “Filters” control. Stays closed when idle so Board/Tracks keep
 * vertical room; opens when the artist asks, or when something is already on.
 */
export function FilterDisclosure({
  active,
  summary,
  onClear,
  children,
  storageKey,
}: {
  active: boolean;
  /** Short label when filters are on, e.g. "Type · Blocked". */
  summary?: string | null;
  onClear?: () => void;
  children: React.ReactNode;
  /** Persist open/closed across visits (optional). */
  storageKey?: string;
}) {
  const [open, setOpen] = React.useState(() => {
    if (active) return true;
    if (typeof window === "undefined" || !storageKey) return false;
    return localStorage.getItem(storageKey) === "1";
  });

  React.useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        localStorage.setItem(storageKey, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            "inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-xs transition-colors duration-hover",
            open || active
              ? "border-ice/40 bg-ice/10 text-ice"
              : "border-line bg-bg-2 text-text-lo hover:text-text-hi"
          )}
        >
          Filters
          {active && summary ? (
            <span className="max-w-[10rem] truncate font-normal text-ice/80">
              · {summary}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-hover",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {active && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-ice hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
