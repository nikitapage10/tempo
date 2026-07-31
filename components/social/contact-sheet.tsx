"use client";

import * as React from "react";
import Link from "next/link";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePersonAppearances } from "@/hooks/use-people";
import type { Person } from "@/lib/types";

export function ContactSheet({
  person,
  open,
  onOpenChange,
}: {
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: appearances = [] } = usePersonAppearances(
    open && person ? person.id : null
  );

  if (!person) return null;

  const lp = person.linked_profile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={person.display_name} onClose={() => onOpenChange(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ArtistMark
              emblemUrl={lp?.emblem_url ?? person.avatar_url}
              paletteId={lp?.palette_id}
              iceColor={lp?.ice_color}
              amberColor={lp?.amber_color}
              name={person.display_name}
              size={28}
              className="size-7"
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-text-hi">{person.display_name}</p>
              {person.primary_email ? (
                <p className="truncate text-xs text-text-lo">{person.primary_email}</p>
              ) : null}
              {lp?.handle ? (
                <Link
                  href={`/artist/${lp.handle}`}
                  className="text-xs text-ice hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  @{lp.handle}
                </Link>
              ) : (
                <p className="text-xs text-text-lo">No TEMPO profile linked yet</p>
              )}
            </div>
          </div>

          {person.roles.length ? (
            <div>
              <p className="label-mono mb-1.5">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {person.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {person.notes ? (
            <div>
              <p className="label-mono mb-1.5">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-text-hi">{person.notes}</p>
            </div>
          ) : null}

          <div>
            <p className="label-mono mb-1.5">How you know them</p>
            {appearances.length === 0 ? (
              <p className="text-sm text-text-lo">
                Seeded from {person.source.replace("_", " ")}.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {appearances.map((a) => (
                  <li
                    key={a.id}
                    className="well rounded-input px-3 py-2 text-sm text-text-hi"
                  >
                    {a.label || a.role || a.source}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
