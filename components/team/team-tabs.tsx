"use client";

import { cn } from "@/lib/utils";

export function TeamTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { key: T; label: string; count?: number }[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Team operations" className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "border-b-2 px-3 py-2 text-sm transition-colors duration-hover",
            active === tab.key ? "border-ice text-text-hi" : "border-transparent text-text-lo hover:text-text-hi"
          )}
        >
          {tab.label}{tab.count == null ? "" : ` (${tab.count})`}
        </button>
      ))}
    </div>
  );
}
