"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { Button } from "@/components/ui/button";
import { QuietEmpty, SectionHeader } from "@/components/ui/section-header";
import { SignedImage } from "@/components/ui/signed-image";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  compactCount,
  fetchArtistHubSnapshot,
  summarizeRoster,
  type ArtistHubSnapshot,
} from "@/lib/api/artist-hub";
import { listMemberOfArtists } from "@/lib/api/artist-members";
import { fetchMyWork, type MyWorkItem } from "@/lib/api/team-operations";
import { parseDateKey } from "@/lib/calendar/date";
import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import {
  excludePersonalHomeWork,
  nextWorkByArtist,
  rankWaitingOnYou,
  sortProHubArtists,
  WAITING_ON_YOU_LIMIT,
  WAITING_URGENCY_LABELS,
} from "@/lib/today/pro-hub";
import { cn, initials } from "@/lib/utils";
import { membershipArtists, ownedPersonalWorkspace } from "@/lib/workspace-mode";
import type { Artist } from "@/lib/types";

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
    <div className="size-11 shrink-0 overflow-hidden rounded-xl border border-line bg-bg-2 shadow-e1">
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

function WaitingRow({
  item,
  onOpen,
}: {
  item: MyWorkItem;
  onOpen: (item: MyWorkItem) => void;
}) {
  const overdue = item.urgency === "overdue";
  return (
    <li>
      <Link
        href={item.href}
        onClick={() => onOpen(item)}
        className="lift flex w-full items-start gap-3 rounded-input border border-transparent px-2 py-2"
      >
        <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-line bg-bg-2">
          <SignedImage
            path={item.artistEmblemPath}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center font-display text-xs text-text-hi">
                {initials(item.artistName)}
              </div>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("label-mono", overdue ? "text-warn" : "text-text-lo")}>
              {WAITING_URGENCY_LABELS[item.urgency]}
            </span>
            <span className="truncate text-xs text-ice">{item.artistName}</span>
          </div>
          <p className={cn("mt-0.5 truncate text-sm", overdue ? "text-warn" : "text-text-hi")}>
            {item.title}
          </p>
        </div>
        <span className="mt-1 shrink-0 text-xs text-ice">{item.primaryAction}</span>
      </Link>
    </li>
  );
}

function ArtistHubCard({
  artist,
  role,
  snapshot,
  nextWork,
  onEnter,
  onOpenWork,
}: {
  artist: Artist;
  role: MemberRole;
  snapshot: ArtistHubSnapshot | undefined;
  nextWork: MyWorkItem | undefined;
  onEnter: () => void;
  onOpenWork: (item: MyWorkItem) => void;
}) {
  const next = snapshot?.upcoming[0];
  const overdue = snapshot?.overdue ?? 0;
  const handle = snapshot?.handle;
  const hasBanner = !!artist.banner_url || !!artist.banner_color;

  return (
    <SpotlightCard
      as="article"
      tone={overdue > 0 ? "warn" : "ramp"}
      radius={16}
      size={240}
      className="panel-quiet overflow-hidden"
    >
      <div className="relative">
        {hasBanner ? (
          <div className="relative h-[4.75rem] overflow-hidden">
            <ArtistBanner artist={artist} className="absolute inset-0" />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[rgb(10_10_12_/_0.55)] to-transparent"
            />
          </div>
        ) : null}
        <div className={cn("relative space-y-3 px-4 pb-4", hasBanner ? "-mt-6" : "pt-4")}>
          <div className="flex items-end gap-3">
            <ArtistMark artist={artist} />
            <div className="min-w-0 flex-1 pb-0.5">
              {handle ? (
                <Link
                  href={`/artist/${handle}`}
                  className="block truncate font-display text-sm text-text-hi hover:underline"
                >
                  {artist.name}
                </Link>
              ) : (
                <p className="truncate font-display text-sm text-text-hi">{artist.name}</p>
              )}
              <p className="label-mono mt-0.5 text-text-lo">{ROLE_LABELS[role]}</p>
            </div>
            <Button type="button" size="sm" className="shrink-0" onClick={onEnter}>
              Enter
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric
              label="Overdue"
              value={compactCount(snapshot?.overdue)}
              warn={overdue > 0}
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
          </div>
          {nextWork ? (
            <Link
              href={nextWork.href}
              onClick={() => onOpenWork(nextWork)}
              className="well block w-full rounded-input px-3 py-2"
            >
              <p className="label-mono text-text-lo">Waiting</p>
              <p
                className={cn(
                  "mt-0.5 truncate text-sm",
                  nextWork.urgency === "overdue" ? "text-warn" : "text-amber"
                )}
              >
                {nextWork.title}
              </p>
            </Link>
          ) : null}
        </div>
      </div>
    </SpotlightCard>
  );
}

function Metric({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
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
      {detail ? <p className="truncate text-text-lo">{detail}</p> : null}
    </div>
  );
}

export function ProTodayHub() {
  const user = useCurrentUser();
  const { artists, setActiveArtistId } = useActiveArtist();
  const { setActiveSpaceId } = useActiveSpace();
  const personalHomeId = ownedPersonalWorkspace(artists, user?.id)?.id ?? null;
  const roster = membershipArtists(artists, user?.id);

  const membershipsQuery = useQuery({
    queryKey: ["member-of-artists", user?.id],
    queryFn: listMemberOfArtists,
    enabled: !!user,
    staleTime: 60_000,
  });
  const workQuery = useQuery({
    queryKey: ["team-operations", "my-work", "all"],
    queryFn: () => fetchMyWork({ kind: null }),
    staleTime: 15_000,
  });

  const memberships = membershipsQuery.data ?? [];
  const snapshotQueries = useQueries({
    queries: memberships.map((m) => ({
      queryKey: ["artist-hub", m.artistId, m.areas],
      queryFn: () => fetchArtistHubSnapshot(m.artistId, m.areas),
      staleTime: 30_000,
    })),
  });

  const rows = memberships
    .map((m, i) => {
      const artist = roster.find((a) => a.id === m.artistId);
      if (!artist) return null;
      return {
        membership: m,
        artist,
        snapshot: snapshotQueries[i]?.data,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const waitingSource = excludePersonalHomeWork(workQuery.data ?? [], personalHomeId);
  const ranked = rankWaitingOnYou(waitingSource);
  const waiting = ranked.slice(0, WAITING_ON_YOU_LIMIT);
  const nextWork = nextWorkByArtist(ranked);
  const sortedRows = sortProHubArtists(
    rows.map((row) => ({
      ...row,
      name: row.artist.name,
      overdue: row.snapshot?.overdue ?? null,
      hasWaitingWork: nextWork.has(row.membership.artistId),
    }))
  );
  const totals = summarizeRoster(
    rows.map((r) => r.snapshot).filter((s): s is ArtistHubSnapshot => !!s)
  );
  const loading = membershipsQuery.isLoading || workQuery.isLoading;
  const showWaiting = loading || waiting.length > 0 || sortedRows.length > 0;

  function openWork(item: MyWorkItem) {
    setActiveArtistId(item.artistId);
    if (item.spaceId) setActiveSpaceId(item.spaceId);
  }

  return (
    <div data-tour="pro-today-hub" className="space-y-4">
      {showWaiting ? (
        <section className="panel p-5">
          <SectionHeader
            label="Waiting on you"
            count={waitingSource.length}
            aside={
              <Link href="/team?tab=work" className="text-xs text-ice hover:underline">
                My Work
              </Link>
            }
          />
          {loading && waiting.length === 0 ? (
            <div className="h-20 animate-pulse rounded-card bg-bg-2" />
          ) : waiting.length === 0 ? (
            <QuietEmpty>Nothing waiting across the roster.</QuietEmpty>
          ) : (
            <ul className="space-y-1">
              {waiting.map((item) => (
                <WaitingRow key={`${item.kind}:${item.sourceId}`} item={item} onOpen={openWork} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <SectionHeader
          label="Artists you work with"
          count={sortedRows.length}
          aside={
            <Link href="/team?tab=roster" className="text-xs text-ice hover:underline">
              Roster
            </Link>
          }
        />
        {loading && sortedRows.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-40 animate-pulse rounded-panel bg-bg-2/40" />
            <div className="h-40 animate-pulse rounded-panel bg-bg-2/40" />
          </div>
        ) : sortedRows.length === 0 ? (
          <QuietEmpty>
            When an artist invites you onto their team, they’ll show up here
            with overdue work, what’s next, and a way into their workspace.
          </QuietEmpty>
        ) : (
          <>
            {totals.overdue || totals.week ? (
              <p className="mb-3 text-xs text-text-lo">
                {totals.overdue ? (
                  <span className={totals.overdue > 0 ? "text-warn" : undefined}>
                    {compactCount(totals.overdue)} overdue
                  </span>
                ) : null}
                {totals.overdue && totals.week ? " · " : null}
                {totals.week ? <span>{compactCount(totals.week)} coming this week</span> : null}
                {" across the roster."}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedRows.map((row) => (
                <ArtistHubCard
                  key={row.membership.artistId}
                  artist={row.artist}
                  role={row.membership.role}
                  snapshot={row.snapshot}
                  nextWork={nextWork.get(row.membership.artistId)}
                  onEnter={() => setActiveArtistId(row.membership.artistId)}
                  onOpenWork={openWork}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
