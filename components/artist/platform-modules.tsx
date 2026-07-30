"use client";

import * as React from "react";
import { ExternalLink, Link2, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import {
  AXIS_TEXT,
  GRID,
  useChartPalette,
  useMeasuredWidth,
} from "@/components/artist/chart-kit";
import {
  useAppleCatalog,
  usePlatformMutations,
  usePlatformSnapshots,
} from "@/hooks/use-platform-stats";
import {
  resolvePlatformLink,
  type PlatformId,
  type PlatformSnapshot,
} from "@/lib/api/platform-stats";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/* ------------------------------------------------------------------ */
/* Shared shell                                                        */
/* ------------------------------------------------------------------ */

/**
 * Platform modules all have the same three states: not linked, linked but
 * never fetched, and linked with snapshots. The shell carries the linking
 * form so each platform component only describes its own numbers.
 */
function PlatformShell({
  label,
  quiet,
  linked,
  linkHint,
  onLink,
  onUnlink,
  onRefresh,
  refreshing,
  children,
}: {
  label: string;
  quiet?: boolean;
  linked: boolean;
  linkHint: string;
  onLink: (input: string) => Promise<void>;
  onUnlink?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
}) {
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    try {
      await onLink(input.trim());
      setInput("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t link that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn(quiet ? "panel-quiet" : "panel", "p-5")}>
      <SectionHeader
        label={label}
        aside={
          linked ? (
            <div className="flex items-center gap-1">
              {onRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-50"
                  aria-label={`Refresh ${label}`}
                >
                  <RefreshCw
                    className={cn("size-3.5", refreshing && "animate-spin")}
                  />
                </button>
              ) : null}
              {onUnlink ? (
                <button
                  type="button"
                  onClick={onUnlink}
                  className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  aria-label={`Unlink ${label}`}
                >
                  <Unlink className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null
        }
      />

      {linked ? (
        children
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <p className="text-sm text-text-lo">{linkHint}</p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your profile link…"
              className="h-9 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />
            <Button type="submit" size="sm" disabled={busy || !input.trim()}>
              <Link2 className="size-3.5" />
              {busy ? "Linking…" : "Link"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Followers/plays over time. One series, so one colour and no legend box. */
function TrendLine({
  points,
  label,
}: {
  points: { date: string; value: number }[];
  label: string;
}) {
  const palette = useChartPalette();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const H = 56;
  const PAD = 4;

  if (points.length < 2) {
    return (
      <p className="text-[11px] text-text-lo">
        {points.length === 1
          ? "One day recorded — the trend line starts once there are two."
          : "No history yet."}
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) =>
    PAD + (i / (points.length - 1)) * Math.max(0, width - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const d = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const change = values[values.length - 1] - values[0];

  return (
    <div ref={ref} className="w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`${label} over ${points.length} days, ${change >= 0 ? "up" : "down"} ${Math.abs(change)}.`}
        >
          <line
            x1={0}
            x2={width}
            y1={H - PAD}
            y2={H - PAD}
            stroke={GRID}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <polyline
            points={d}
            fill="none"
            stroke={palette.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={x(points.length - 1)}
            cy={y(values[values.length - 1])}
            r={4}
            fill={palette.primary}
            stroke="#121216"
            strokeWidth={2}
          />
          <text x={0} y={10} fontSize={10} fill={AXIS_TEXT}>
            {points.length} days
          </text>
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
    </div>
  );
}

function latestOf(
  snapshots: PlatformSnapshot[],
  platform: PlatformId
): PlatformSnapshot | null {
  const rows = snapshots.filter((s) => s.platform === platform);
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function seriesOf(
  snapshots: PlatformSnapshot[],
  platform: PlatformId,
  pick: (s: PlatformSnapshot) => number | null
): { date: string; value: number }[] {
  return snapshots
    .filter((s) => s.platform === platform)
    .map((s) => ({ date: s.captured_on, value: pick(s) ?? 0 }))
    .filter((p) => p.value > 0);
}

function Figure({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[22px] leading-none text-text-hi">{value}</p>
      <p className="label-mono mt-1.5">{label}</p>
      {hint ? <p className="mt-1 text-[10px] text-text-lo/70">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spotify                                                             */
/* ------------------------------------------------------------------ */

export function SpotifyModule({ artist }: { artist: Artist }) {
  const { toast } = useToast();
  const snapshotsQuery = usePlatformSnapshots(artist.id);
  const { link, refresh } = usePlatformMutations(artist.id);
  const linked = !!artist.spotify_artist_id;

  const snapshots = snapshotsQuery.data ?? [];
  const latest = latestOf(snapshots, "spotify");
  const followerSeries = seriesOf(snapshots, "spotify", (s) => s.followers);
  const detail = (latest?.detail ?? {}) as {
    topTracks?: { name: string; popularity: number }[];
    genres?: string[];
  };

  return (
    <PlatformShell
      label="Spotify"
      linked={linked}
      linkHint="Paste your Spotify artist link and TEMPO will track followers and popularity over time. Streams and monthly listeners aren’t available to any app — only Spotify for Artists has those."
      onLink={async (input) => {
        const resolved = await resolvePlatformLink("spotify", input);
        await link.mutateAsync({ platform: "spotify", platformId: resolved.id });
        await refresh.mutateAsync("spotify").catch(() => {});
        toast(`Linked to ${resolved.name}`, "ok");
      }}
      onUnlink={() =>
        link.mutate(
          { platform: "spotify", platformId: null },
          { onSuccess: () => toast("Spotify unlinked", "ok") }
        )
      }
      onRefresh={() =>
        refresh.mutate("spotify", {
          onSuccess: () => toast("Spotify updated", "ok"),
          onError: (err) =>
            toast(err instanceof Error ? err.message : "Couldn’t refresh."),
        })
      }
      refreshing={refresh.isPending}
    >
      {!latest ? (
        <QuietEmpty>
          Linked, but nothing recorded yet — hit refresh to take the first
          reading.
        </QuietEmpty>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <Figure value={compact(latest.followers)} label="Followers" />
            <Figure
              value={latest.popularity != null ? String(latest.popularity) : "—"}
              label="Popularity"
              hint="0–100, Spotify's own measure"
            />
          </div>

          <div className="mt-4">
            <TrendLine points={followerSeries} label="Spotify followers" />
          </div>

          {detail.topTracks && detail.topTracks.length > 0 ? (
            <>
              <p className="label-mono mb-2 mt-5">Top tracks on Spotify</p>
              <ul className="space-y-1">
                {detail.topTracks.slice(0, 5).map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center gap-3 text-[12px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-text-hi">
                      {t.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-text-lo">
                      {t.popularity}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="mt-4 text-[10px] text-text-lo/70">
            Last read {latest.captured_on}. Spotify doesn’t publish stream
            counts to apps — these are followers and its relative popularity
            score.
          </p>
        </>
      )}
    </PlatformShell>
  );
}

/* ------------------------------------------------------------------ */
/* SoundCloud                                                          */
/* ------------------------------------------------------------------ */

export function SoundCloudModule({ artist }: { artist: Artist }) {
  const { toast } = useToast();
  const snapshotsQuery = usePlatformSnapshots(artist.id);
  const { link, refresh } = usePlatformMutations(artist.id);
  const linked = !!artist.soundcloud_user_id;

  const snapshots = snapshotsQuery.data ?? [];
  const latest = latestOf(snapshots, "soundcloud");
  const playSeries = seriesOf(snapshots, "soundcloud", (s) => s.plays);
  const detail = (latest?.detail ?? {}) as {
    tracks?: { id: number; title: string; plays: number; likes: number }[];
  };

  return (
    <PlatformShell
      label="SoundCloud"
      linked={linked}
      linkHint="Paste your SoundCloud profile URL to track plays, likes and reposts. SoundCloud gives apps today’s totals only, so TEMPO records them daily to build the history itself."
      onLink={async (input) => {
        const resolved = await resolvePlatformLink("soundcloud", input);
        await link.mutateAsync({
          platform: "soundcloud",
          platformId: resolved.id,
        });
        await refresh.mutateAsync("soundcloud").catch(() => {});
        toast(`Linked to ${resolved.name}`, "ok");
      }}
      onUnlink={() =>
        link.mutate(
          { platform: "soundcloud", platformId: null },
          { onSuccess: () => toast("SoundCloud unlinked", "ok") }
        )
      }
      onRefresh={() =>
        refresh.mutate("soundcloud", {
          onSuccess: () => toast("SoundCloud updated", "ok"),
          onError: (err) =>
            toast(err instanceof Error ? err.message : "Couldn’t refresh."),
        })
      }
      refreshing={refresh.isPending}
    >
      {!latest ? (
        <QuietEmpty>
          Linked, but nothing recorded yet — hit refresh to take the first
          reading.
        </QuietEmpty>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <Figure value={compact(latest.plays)} label="Plays" />
            <Figure value={compact(latest.followers)} label="Followers" />
            <Figure value={compact(latest.likes)} label="Likes" />
            <Figure value={compact(latest.reposts)} label="Reposts" />
          </div>

          <div className="mt-4">
            <TrendLine points={playSeries} label="SoundCloud plays" />
          </div>

          {detail.tracks && detail.tracks.length > 0 ? (
            <>
              <p className="label-mono mb-2 mt-5">Most played</p>
              <ul className="space-y-1">
                {detail.tracks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-text-hi">
                      {t.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-text-lo">
                      {compact(t.plays)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="mt-4 text-[10px] text-text-lo/70">
            Last read {latest.captured_on}. Totals across your public tracks —
            SoundCloud’s Insights breakdowns aren’t available to apps.
          </p>
        </>
      )}
    </PlatformShell>
  );
}

/* ------------------------------------------------------------------ */
/* Apple — catalog only                                                */
/* ------------------------------------------------------------------ */

export function AppleModule({ artist }: { artist: Artist }) {
  const { toast } = useToast();
  const { link } = usePlatformMutations(artist.id);
  const linked = !!artist.apple_artist_id;
  const catalogQuery = useAppleCatalog(artist.id, linked);

  return (
    <PlatformShell
      label="Apple Music"
      quiet
      linked={linked}
      linkHint="Paste your Apple Music artist link to show your releases as Apple lists them. Apple publishes no free stats API, so this is catalog only — no plays or followers."
      onLink={async (input) => {
        const id = input.match(/artist\/[^/]*\/(\d+)/)?.[1] ?? input.match(/\d{6,}/)?.[0];
        if (!id) throw new Error("That isn’t an Apple Music artist link.");
        await link.mutateAsync({ platform: "apple", platformId: id });
        toast("Linked to Apple Music", "ok");
      }}
      onUnlink={() =>
        link.mutate(
          { platform: "apple", platformId: null },
          { onSuccess: () => toast("Apple Music unlinked", "ok") }
        )
      }
    >
      {catalogQuery.isLoading ? (
        <div className="h-20 animate-pulse rounded-card bg-bg-2" />
      ) : catalogQuery.isError ? (
        <p className="text-sm text-warn">
          {catalogQuery.error instanceof Error
            ? catalogQuery.error.message
            : "Couldn’t load the Apple catalog."}
        </p>
      ) : !catalogQuery.data || catalogQuery.data.releases.length === 0 ? (
        <QuietEmpty>Nothing listed on Apple Music under this artist yet.</QuietEmpty>
      ) : (
        <>
          <ul className="space-y-1">
            {catalogQuery.data.releases.slice(0, 8).map((release) => (
              <li
                key={release.id}
                className="well flex items-center gap-3 rounded-input px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-text-hi">
                  {release.name}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-text-lo">
                  {release.releaseDate ?? "—"}
                </span>
                {release.url ? (
                  <a
                    href={release.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0 text-ice"
                    aria-label={`Open ${release.name} on Apple Music`}
                  >
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] text-text-lo/70">
            Catalog only. Apple Music’s stats need a paid developer membership,
            so there are no play counts here.
          </p>
        </>
      )}
    </PlatformShell>
  );
}
