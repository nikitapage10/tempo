"use client";

import { FlareLine } from "@/components/flare-line";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned controls (buttons, toggles). */
  actions?: React.ReactNode;
  /** Extra row below the title — filters, segmented controls. */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Shared page header (v0.13). Replaces the per-page
 * `font-display text-xl` + subtitle pattern so every screen opens with the
 * same weight and the flare motif as a consistent closing rule.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-[0.025em] text-text-hi sm:text-[28px] sm:leading-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-text-lo">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      <FlareLine className="mt-4 opacity-50" />
    </header>
  );
}
