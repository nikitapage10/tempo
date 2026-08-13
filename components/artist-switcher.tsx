"use client";

import * as React from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Disc3,
  Plus,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useActiveArtist } from "@/components/active-artist-provider";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ArtistSwitcher() {
  const { artists, activeArtist, setActiveArtistId, isLoading } =
    useActiveArtist();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const label = activeArtist?.name ?? "No artist";

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

  // Name always stays in the rail at xl+ — the emblem lives on the browser
  // tab and the assistant avatar instead. Below xl the trigger shows
  // initials so the compact icon rail stays usable. Dropdown still opens
  // with one artist so Manage / New artist are a click away.
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={`Artist: ${label}`}
        className="flex w-full items-center justify-center gap-2.5 rounded-input px-1.5 py-1.5 text-left text-sm text-text-hi transition-colors duration-hover hover:bg-bg-2/60 xl:justify-start xl:px-2"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-input border border-line bg-bg-2 font-display text-[11px] tracking-wide text-text-hi xl:hidden">
          {initials(label)}
        </span>
        <span className="hidden min-w-0 truncate font-display text-[13px] tracking-wide xl:inline">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto hidden size-3 shrink-0 text-text-lo transition-transform duration-hover xl:block",
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
            {artists.map((artist) => {
              const selected = artist.id === activeArtist?.id;
              return (
                <li key={artist.id}>
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
                      setActiveArtistId(artist.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        selected ? "text-ice opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{artist.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line">
            <Link
              href="/artist"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <Disc3 className="size-3.5" />
              Artist profile
            </Link>
            <Link
              href="/stats"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <BarChart3 className="size-3.5" />
              Stats
            </Link>
            <Link
              href="/settings?tab=studio#artists"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <Settings2 className="size-3.5" />
              Manage artists
            </Link>
            <Link
              href="/settings?tab=studio#artists"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ice transition-colors duration-hover hover:bg-bg-2/60"
            >
              <Plus className="size-3.5" />
              New artist
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
