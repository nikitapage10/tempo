"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/ui/signed-image";
import { useActiveArtist } from "@/components/active-artist-provider";
import { fetchArtistHubSnapshot } from "@/lib/api/artist-hub";
import { AREA_LABELS, canRead, type AreaGrants } from "@/lib/team/areas";
import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import { initials } from "@/lib/utils";
import type { Artist } from "@/lib/types";

function grantSummary(areas: AreaGrants): string {
  const keys = (Object.keys(AREA_LABELS) as (keyof typeof AREA_LABELS)[]).filter((k) =>
    canRead(areas, k)
  );
  if (keys.length === 0) return "No areas granted yet";
  return keys.map((k) => AREA_LABELS[k]).join(" · ");
}

function HubCard({
  artist,
  role,
  areas,
  onEnter,
}: {
  artist: Artist;
  role: MemberRole;
  areas: AreaGrants;
  onEnter: () => void;
}) {
  const snapshot = useQuery({
    queryKey: ["artist-hub", artist.id],
    queryFn: () => fetchArtistHubSnapshot(artist.id, areas),
    staleTime: 30_000,
  });

  return (
    <div className="panel-quiet flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="size-14 overflow-hidden rounded-xl border border-line bg-bg-2">
          <SignedImage
            path={artist.emblem_url ?? artist.logo_url}
            alt={artist.name}
            className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center font-display text-text-hi">
                {initials(artist.name)}
              </div>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base text-text-hi">{artist.name}</p>
          <p className="label-mono mt-0.5 text-text-lo">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <p className="text-xs text-text-lo">{grantSummary(areas)}</p>
      {snapshot.data?.trackCount != null ? (
        <p className="text-xs text-text-lo">
          {snapshot.data.trackCount} track{snapshot.data.trackCount === 1 ? "" : "s"}
        </p>
      ) : null}
      {snapshot.data?.upcoming.length ? (
        <ul className="space-y-1 text-xs text-text-lo">
          {snapshot.data.upcoming.map((ev) => (
            <li key={ev.id} className="truncate">
              {ev.title}
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" size="sm" onClick={onEnter}>
        Enter workspace
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

export function WorkHub({
  artists,
  memberships,
}: {
  artists: Artist[];
  memberships: { artistId: string; role: MemberRole; areas: AreaGrants }[];
}) {
  const { setActiveArtistId } = useActiveArtist();

  if (memberships.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        You’re not on anyone’s team yet. When an artist invites you, they’ll show up here.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {memberships.map((m) => {
        const artist = artists.find((a) => a.id === m.artistId);
        if (!artist) return null;
        return (
          <HubCard
            key={m.artistId}
            artist={artist}
            role={m.role}
            areas={m.areas}
            onEnter={() => setActiveArtistId(m.artistId)}
          />
        );
      })}
    </div>
  );
}
