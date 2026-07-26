"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useActiveSpace } from "@/components/active-space-provider";
import { cn } from "@/lib/utils";

export function SpaceSwitcher() {
  const { spaces, activeSpace, setActiveSpaceId, isLoading } = useActiveSpace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

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
      <div className="h-9 animate-pulse rounded-input border border-line bg-bg-2" />
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-input border border-line bg-bg-2 px-3 py-2 text-left text-sm text-text-hi transition-colors duration-hover hover:border-ice/40"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{activeSpace?.name ?? "No space"}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-text-lo transition-transform duration-hover",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-card border border-line bg-bg-1 shadow-raise"
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
              href="/settings#spaces"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <Settings2 className="size-3.5" />
              Manage spaces
            </Link>
            <Link
              href="/settings#spaces"
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
