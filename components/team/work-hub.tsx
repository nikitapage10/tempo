"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SignedImage } from "@/components/ui/signed-image";
import { useActiveArtist } from "@/components/active-artist-provider";
import {
  compactCount,
  fetchArtistHubSnapshot,
  platformLabel,
  signedDelta,
  summarizeRoster,
  type ArtistHubSnapshot,
} from "@/lib/api/artist-hub";
import { parseDateKey } from "@/lib/calendar/date";
import { AREA_LABELS, canRead, type AreaGrants } from "@/lib/team/areas";
import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import { cn, initials } from "@/lib/utils";
import type { Artist } from "@/lib/types";

function grantSummary(areas: AreaGrants): string {
  const keys = (Object.keys(AREA_LABELS) as (keyof typeof AREA_LABELS)[]).filter((k) =>
    canRead(areas, k)
  );
  if (keys.length === 0) return "No areas granted yet";
  return keys.map((k) => AREA_LABELS[k]).join(" · ");
}

function formatWhen(iso: string): string {
  const key = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso;
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ArtistMark({ artist }: { artist: Artist }) {
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-xl border border-line bg-bg-2 sm:size-12">
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
  );
}

function HubCard({
  artist,
  role,
  areas,
  snapshot,
  onEnter,
}: {
  artist: Artist;
  role: MemberRole;
  areas: AreaGrants;
  snapshot: ArtistHubSnapshot | undefined;
  onEnter: () => void;
}) {
  const handle = snapshot?.handle;
  return (
    <div className="panel-quiet flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <ArtistMark artist={artist} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base text-text-hi">{artist.name}</p>
          <p className="label-mono mt-0.5 text-text-lo">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <p className="text-xs text-text-lo">{grantSummary(areas)}</p>
      <div className="mt-auto flex items-center gap-3">
        <Button type="button" size="sm" onClick={onEnter}>
          Enter workspace
          <ArrowRight className="size-3.5" />
        </Button>
        {handle ? (
          <Link
            href={`/artist/${handle}`}
            className="text-xs text-ice hover:underline"
          >
            Profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RosterRow({
  artist,
  role,
  snapshot,
  onEnter,
}: {
  artist: Artist;
  role: MemberRole;
  snapshot: ArtistHubSnapshot | undefined;
  onEnter: () => void;
}) {
  const next = snapshot?.upcoming[0];
  const delta = signedDelta(snapshot?.followerDelta ?? null);
  const deltaTone =
    snapshot?.followerDelta == null
      ? "text-text-lo"
      : snapshot.followerDelta > 0
        ? "text-ok"
        : snapshot.followerDelta < 0
          ? "text-warn"
          : "text-text-lo";
  const handle = snapshot?.handle;

  return (
    <div data-tour="roster-artist" className="well flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ArtistMark artist={artist} />
        <div className="min-w-0">
          {handle ? (
            <Link href={`/artist/${handle}`} className="truncate font-display text-sm text-text-hi hover:underline">
              {artist.name}
            </Link>
          ) : (
            <p className="truncate font-display text-sm text-text-hi">{artist.name}</p>
          )}
          <p className="label-mono mt-0.5 text-text-lo">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <div className="grid min-w-0 flex-[2] grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Metric
          label="Overdue"
          value={compactCount(snapshot?.overdue)}
          warn={!!snapshot?.overdue}
        />
        <Metric
          label="Next up"
          value={next ? formatWhen(next.startAt) : "—"}
          detail={next?.title}
        />
        <Metric
          label="Catalog"
          value={
            snapshot?.trackCount == null
              ? "—"
              : `${snapshot.trackCount} track${snapshot.trackCount === 1 ? "" : "s"}`
          }
        />
        <Metric
          label={platformLabel(snapshot?.followerPlatform) ?? "Followers"}
          value={compactCount(snapshot?.followers ?? snapshot?.networkFollowers)}
          detail={delta ?? undefined}
          detailClass={deltaTone}
        />
      </div>
      <Button type="button" size="sm" className="shrink-0 self-start sm:self-center" onClick={onEnter}>
        Enter
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  warn,
  detailClass,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
  detailClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="label-mono text-text-lo">{label}</p>
      <p
        className={cn(
          "truncate font-data text-sm tabular-nums",
          warn ? "text-warn" : "text-text-hi"
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className={cn("truncate text-text-lo", detailClass)}>{detail}</p>
      ) : null}
    </div>
  );
}

function OverviewTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <div className="panel-quiet p-4">
      <p className="label-mono text-text-lo">{label}</p>
      <p
        className={cn(
          "stat-value mt-2 text-text-hi",
          tone === "warn" && "text-warn",
          tone === "ok" && "text-ok"
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-text-lo">{detail}</p> : null}
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
  const snapshotQueries = useQueries({
    queries: memberships.map((m) => ({
      queryKey: ["artist-hub", m.artistId, m.areas],
      queryFn: () => fetchArtistHubSnapshot(m.artistId, m.areas),
      staleTime: 30_000,
    })),
  });

  if (memberships.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        You’re not on anyone’s team yet. When an artist invites you, they’ll show up here.
      </p>
    );
  }

  const rows = memberships
    .map((m, i) => {
      const artist = artists.find((a) => a.id === m.artistId);
      if (!artist) return null;
      return {
        membership: m,
        artist,
        snapshot: snapshotQueries[i]?.data,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const totals = summarizeRoster(rows.map((r) => r.snapshot).filter((s): s is ArtistHubSnapshot => !!s));
  const followerDelta = signedDelta(totals.followerDelta);
  const showOverdue = rows.some((r) => r.snapshot && r.snapshot.overdue != null);
  const showWeek = rows.some((r) => r.snapshot && r.snapshot.weekCount != null);
  const showFollowers = rows.some(
    (r) => r.snapshot && (r.snapshot.followers != null || r.snapshot.networkFollowers != null)
  );

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader label="Roster" count={rows.length} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewTile
            label="Artists"
            value={String(rows.length)}
            detail="On your roster"
          />
          {showOverdue ? (
            <OverviewTile
              label="Overdue"
              value={compactCount(totals.overdue)}
              detail={totals.overdue ? "Deadlines past due" : "Nothing past due"}
              tone={totals.overdue ? "warn" : "default"}
            />
          ) : null}
          {showWeek ? (
            <OverviewTile
              label="This week"
              value={compactCount(totals.week)}
              detail="Tasks and dates coming up"
            />
          ) : null}
          {showFollowers ? (
            <OverviewTile
              label="Followers"
              value={compactCount(totals.followers ?? totals.networkFollowers)}
              detail={
                totals.followers != null
                  ? followerDelta
                    ? `${followerDelta} since last snapshot`
                    : "From linked platforms"
                  : "On TEMPO"
              }
              tone={
                totals.followerDelta && totals.followerDelta > 0
                  ? "ok"
                  : totals.followerDelta && totals.followerDelta < 0
                    ? "warn"
                    : "default"
              }
            />
          ) : null}
        </div>
        <div className="panel mt-4 space-y-2 p-3">
          {rows.map((row) => (
            <RosterRow
              key={row.membership.artistId}
              artist={row.artist}
              role={row.membership.role}
              snapshot={row.snapshot}
              onEnter={() => setActiveArtistId(row.membership.artistId)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader label="Workspaces" count={rows.length} />
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <HubCard
              key={row.membership.artistId}
              artist={row.artist}
              role={row.membership.role}
              areas={row.membership.areas}
              snapshot={row.snapshot}
              onEnter={() => setActiveArtistId(row.membership.artistId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
