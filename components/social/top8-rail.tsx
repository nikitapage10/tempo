"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus, Search, Star, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Input } from "@/components/ui/input";
import {
  filterTop8Candidates,
  partitionTop8,
  TOP8_SLOTS,
  type Top8Candidate,
} from "@/lib/social/top8";
import { cn } from "@/lib/utils";

export type { Top8Candidate };

type Top8RailProps = {
  /** Ordered ids the owner picked — up to 8. */
  top8: string[];
  /** Followers and people you follow — anyone eligible to pick. */
  candidates: Top8Candidate[];
  editable: boolean;
  saving?: boolean;
  /**
   * False while follows are still loading. A saved pick can't be told apart
   * from a dead one until they arrive, so placeholders wait for this.
   */
  candidatesReady?: boolean;
  onChange: (next: string[]) => void;
};

const EMPTY_TOP8: string[] = [];

/**
 * A MySpace-style Top 8 — the owner's fixed set of quick-access people.
 * Picker uses a full-screen backdrop (not a document pointer listener) so a
 * tap on a name cannot race an outside-dismiss handler.
 */
export function Top8Rail({
  top8,
  candidates,
  editable,
  saving,
  candidatesReady = true,
  onChange,
}: Top8RailProps) {
  const stableTop8 = top8.length ? top8 : EMPTY_TOP8;
  const top8Key = stableTop8.join("\0");

  // Local copy so a pick shows immediately; sync only when the saved list
  // actually changes (not on every parent re-render with a fresh [] ref).
  const [localTop8, setLocalTop8] = React.useState(stableTop8);
  React.useEffect(() => {
    setLocalTop8(stableTop8);
  }, [top8Key, stableTop8]);

  const [pickingIndex, setPickingIndex] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const [panelPos, setPanelPos] = React.useState<{
    left: number;
    width: number;
    bottom: number;
    maxHeight: number;
  } | null>(null);
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);

  const byId = React.useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  );
  const { picked, unavailable } = partitionTop8(localTop8, candidates, {
    candidatesReady,
  });
  const pickable = candidates.filter((c) => !localTop8.includes(c.id));
  const matches = filterTop8Candidates(pickable, query);
  const picking = pickingIndex !== null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const placePanel = React.useCallback(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const gap = 8;
    setPanelPos({
      left,
      width,
      bottom: window.innerHeight - rect.top + gap,
      maxHeight: Math.max(140, rect.top - 16),
    });
  }, []);

  function closePicker() {
    setPickingIndex(null);
    setQuery("");
    setPanelPos(null);
    anchorRef.current = null;
  }

  React.useEffect(() => {
    if (!picking) return;
    placePanel();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePicker();
    }
    window.addEventListener("resize", placePanel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("keydown", onKey);
    };
  }, [picking, pickingIndex, placePanel]);

  function commit(next: string[]) {
    setLocalTop8(next);
    onChange(next);
  }

  function remove(id: string) {
    commit(localTop8.filter((x) => x !== id));
  }

  function clearUnavailable() {
    commit(localTop8.filter((id) => byId.has(id)));
  }

  function add(id: string) {
    if (localTop8.includes(id) || localTop8.length >= TOP8_SLOTS) return;
    commit([...localTop8, id]);
    closePicker();
  }

  function togglePicker(index: number, el: HTMLButtonElement) {
    if (pickingIndex === index) {
      closePicker();
      return;
    }
    setQuery("");
    anchorRef.current = el;
    setPickingIndex(index);
  }

  const emptyCount = editable
    ? Math.max(0, TOP8_SLOTS - localTop8.length)
    : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-mono flex items-center gap-1.5">
          <Star className="size-3" /> Top 8
        </p>
        <div className="flex items-center gap-2">
          {editable && unavailable.length ? (
            <button
              type="button"
              onClick={clearUnavailable}
              className="text-[11px] text-text-lo underline-offset-2 hover:text-ice hover:underline"
            >
              Free {unavailable.length} slot{unavailable.length === 1 ? "" : "s"}
            </button>
          ) : null}
          {saving ? (
            <span className="text-[11px] text-text-lo">Saving…</span>
          ) : null}
        </div>
      </div>

      {picked.length === 0 && !editable ? (
        <p className="text-sm text-text-lo">No picks yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {picked.map((c) => (
            <div key={c.id} className="group relative">
              <Link
                href={c.handle ? `/artist/${c.handle}` : "#"}
                className={cn(
                  "well lift flex items-center gap-3 rounded-card p-3",
                  !c.handle && "pointer-events-none opacity-60"
                )}
              >
                <ArtistMark
                  emblemUrl={c.emblemUrl}
                  paletteId={c.paletteId}
                  iceColor={c.iceColor}
                  amberColor={c.amberColor}
                  name={c.name}
                  size={22}
                  className="size-[22px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-hi">{c.name}</p>
                  {c.handle ? (
                    <p className="truncate text-xs text-text-lo">@{c.handle}</p>
                  ) : null}
                </div>
              </Link>
              {editable ? (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label={`Remove ${c.name} from Top 8`}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-line bg-bg-1 text-text-lo opacity-0 shadow-e1 transition-opacity hover:text-warn group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}

          {unavailable.map((id) => (
            <div
              key={id}
              className="well flex items-center gap-3 rounded-card p-3 opacity-70"
            >
              <span className="size-[22px] shrink-0 rounded-full border border-dashed border-line" />
              <p className="min-w-0 flex-1 truncate text-sm text-text-lo">
                No longer available
              </p>
              {editable ? (
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label="Free this Top 8 slot"
                  className="shrink-0 text-text-lo hover:text-warn"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}

          {Array.from({ length: emptyCount }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              aria-expanded={pickingIndex === i}
              aria-haspopup="listbox"
              onClick={(e) => togglePicker(i, e.currentTarget)}
              className={cn(
                "well flex items-center gap-3 rounded-card border border-dashed p-3 text-text-lo transition-colors hover:border-ice/40 hover:text-ice",
                pickingIndex === i
                  ? "border-ice/40 text-ice"
                  : "border-line/70"
              )}
            >
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-current">
                <Plus className="size-3" />
              </span>
              <span className="text-sm">Add someone</span>
            </button>
          ))}
        </div>
      )}

      {mounted && picking && panelPos
        ? createPortal(
            <>
              {/* Explicit dismiss layer — no document-wide pointer listeners. */}
              <div
                aria-hidden
                className="fixed inset-0 z-[99]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  closePicker();
                }}
              />
              <div
                role="dialog"
                aria-label="Search followers and follows"
                style={{
                  position: "fixed",
                  left: panelPos.left,
                  width: panelPos.width,
                  bottom: panelPos.bottom,
                  maxHeight: panelPos.maxHeight,
                }}
                className="z-[100] flex flex-col overflow-hidden rounded-card border border-line bg-bg-1 p-1.5 shadow-e2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search followers and follows"
                    aria-label="Search followers and follows"
                    className="h-8 pl-8 text-sm"
                  />
                </div>
                <div className="mt-1 min-h-0 flex-1 overflow-y-auto" role="listbox">
                  {pickable.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-text-lo">
                      Nobody left to add — follow people, or wait for followers.
                    </p>
                  ) : matches.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-text-lo">
                      No followers or follows match that.
                    </p>
                  ) : (
                    matches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        // Commit on pointerdown so focus-stealing from the
                        // search field cannot cancel the pick before click.
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          add(c.id);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-input px-2 py-1.5 text-left hover:bg-bg-2"
                      >
                        <ArtistMark
                          emblemUrl={c.emblemUrl}
                          paletteId={c.paletteId}
                          iceColor={c.iceColor}
                          amberColor={c.amberColor}
                          name={c.name}
                          size={20}
                          className="size-5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-hi">
                            {c.name}
                          </span>
                          {c.handle ? (
                            <span className="block truncate text-[11px] text-text-lo">
                              @{c.handle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </section>
  );
}
