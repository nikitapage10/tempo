"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useActiveSpace } from "@/components/active-space-provider";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function SpaceSwitcher() {
  const { spaces, activeSpace, setActiveSpaceId, isLoading } = useActiveSpace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const label = activeSpace?.name ?? "No space";

  React.useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (isLoading) {
    return (
      <div className="mx-auto h-9 w-9 animate-pulse rounded-input border border-line bg-bg-2 xl:mx-0 xl:w-full" />
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={`Space: ${label}`}
        className="flex w-full items-center justify-center rounded-input border border-line bg-bg-2 px-1.5 py-1.5 text-left text-sm text-text-hi transition-colors duration-hover hover:border-ice/40 xl:justify-between xl:px-3 xl:py-2"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-input font-mono text-[11px] text-text-hi xl:hidden">
          {initials(label)}
        </span>
        <span className="hidden min-w-0 truncate xl:inline">{label}</span>
        <ChevronDown
          className={cn(
            "hidden size-3.5 shrink-0 text-text-lo transition-transform duration-hover xl:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-full top-0 z-50 ml-1.5 w-56 overflow-hidden rounded-card border border-line bg-bg-1 shadow-raise xl:left-0 xl:right-0 xl:top-auto xl:ml-0 xl:mt-1.5 xl:w-auto"
        >
          <ul className="max-h-56 overflow-y-auto py-1">
            {spaces.map((space) => {
              const selected = space.id === activeSpace?.id;
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-hover",
                      selected
                        ? "bg-bg-2 text-text-hi"
                        : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
                    )}
                    onClick={() => {
                      setActiveSpaceId(space.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        selected ? "text-ice opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{space.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line">
            <Link
              href="/settings?tab=studio#spaces"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <Settings2 className="size-3.5" />
              Manage spaces
            </Link>
            <Link
              href="/settings?tab=studio#spaces"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ice transition-colors duration-hover hover:bg-bg-2/60"
            >
              <Plus className="size-3.5" />
              New space
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
