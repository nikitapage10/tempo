"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Star, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { cn } from "@/lib/utils";

export type Top8Candidate = {
  id: string;
  name: string;
  handle: string | null;
  emblemUrl: string | null;
  paletteId: string | null;
  iceColor: string | null;
  amberColor: string | null;
};

type Top8RailProps = {
  /** Ordered ids the owner picked — up to 8. */
  top8: string[];
  /** Everyone eligible to be picked (followed profiles + linked contacts). */
  candidates: Top8Candidate[];
  editable: boolean;
  saving?: boolean;
  onChange: (next: string[]) => void;
};

const SLOTS = 8;

/**
 * A MySpace-style Top 8 — the owner's fixed set of quick-access people.
 * Styled like the Network tab's contact cards (same row, same footprint) so
 * it reads as a variant of that list rather than a new visual language.
 * Filled slots link straight to a profile; the owner can add from anyone
 * they follow or have a linked contact for, and remove via the row's × .
 */
export function Top8Rail({
  top8,
  candidates,
  editable,
  saving,
  onChange,
}: Top8RailProps) {
  const [picking, setPicking] = React.useState(false);
  const byId = React.useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  );
  const picked = top8.map((id) => byId.get(id)).filter((c): c is Top8Candidate => !!c);
  const pickable = candidates.filter((c) => !top8.includes(c.id));

  function remove(id: string) {
    onChange(top8.filter((x) => x !== id));
  }

  function add(id: string) {
    if (top8.includes(id) || top8.length >= SLOTS) return;
    onChange([...top8, id]);
    setPicking(false);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-mono flex items-center gap-1.5">
          <Star className="size-3" /> Top 8
        </p>
        {saving ? <span className="text-[10px] text-text-lo">Saving…</span> : null}
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

          {editable && picked.length < SLOTS
            ? Array.from({ length: SLOTS - picked.length }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  type="button"
                  onClick={() => setPicking(true)}
                  className="well flex items-center gap-3 rounded-card border border-dashed border-line/70 p-3 text-text-lo transition-colors hover:border-ice/40 hover:text-ice"
                >
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-current">
                    <Plus className="size-3" />
                  </span>
                  <span className="text-sm">Add someone</span>
                </button>
              ))
            : null}
        </div>
      )}

      {picking ? (
        <div className="well max-h-48 overflow-y-auto rounded-input p-1.5">
          {pickable.length === 0 ? (
            <p className="px-2 py-2 text-xs text-text-lo">
              Nobody left to add — follow more people or link a contact to a profile.
            </p>
          ) : (
            pickable.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c.id)}
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
                <span className="truncate text-sm text-text-hi">{c.name}</span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="mt-1 w-full rounded-input px-2 py-1.5 text-center text-xs text-text-lo hover:text-text-hi"
          >
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
