"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ExternalLink, LayoutGrid, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import { SignedImage } from "@/components/ui/signed-image";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistStats } from "@/hooks/use-artist-stats";
import { useArtistLayout } from "@/hooks/use-artist-layout";
import { useChartPalette } from "@/components/artist/chart-kit";
import { MonthlyOutputChart } from "@/components/artist/monthly-output-chart";
import {
  LingeringList,
  MomentumBar,
  PipelineBars,
} from "@/components/artist/pipeline-bars";
import { BpmHistogram, RankedBars } from "@/components/artist/sound-panel";
import { RhythmHeatmap } from "@/components/artist/rhythm-heatmap";
import { SpacesOverview } from "@/components/artist/spaces-overview";
import { ModularWorkspace } from "@/components/track/modular-workspace";
import {
  ALL_ARTIST_MODULE_IDS,
  type ModuleId,
  type ModuleLayout,
} from "@/lib/workspace-presets";
import { formatHours, type ArtistOverview } from "@/lib/artist-stats";
import { cn } from "@/lib/utils";

export default function ArtistOverviewPage() {
  const { activeArtist, isLoading: artistLoading } = useActiveArtist();
  const { data, isLoading, isError, error } = useArtistStats(
    activeArtist?.id ?? null
  );
  const { layout, setLayout, reset } = useArtistLayout(activeArtist?.id ?? null);

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ModuleLayout | null>(null);

  const loading = artistLoading || isLoading;
  const shown = editing ? (draft ?? layout) : layout;

  const sinceLabel = data?.firstActivityAt
    ? new Date(data.firstActivityAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const modules = useArtistModules(data);

  return (
    <div className="space-y-5">
      {/* Identity hero — the one fixed part of the page. */}
      <LfWindow className="relative overflow-hidden rounded-panel border border-line shadow-e3">
        <div className="absolute inset-0">
          <div className="scrim-reveal absolute inset-0" aria-hidden />
          {activeArtist ? (
            <ArtistBanner
              artist={activeArtist}
              fadeRight
              className="absolute inset-0"
            />
          ) : null}
        </div>
        {activeArtist?.logo_url ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-[min(46%,22rem)] items-end justify-end p-2 sm:p-3">
            <SignedImage
              path={activeArtist.logo_url}
              alt={activeArtist.name}
              className="h-auto max-h-[min(66%,9rem)] w-auto max-w-full object-contain sm:max-h-[11rem]"
            />
          </div>
        ) : null}

        {/* Layout controls ride the banner corner — the page's own chrome,
            kept out of the module flow it rearranges. */}
        {data?.hasAnything && !isError ? (
          <div className="absolute right-3 top-3 z-[2] sm:right-4 sm:top-4">
            <LayoutBar
              editing={editing}
              onEdit={() => {
                setDraft(layout);
                setEditing(true);
              }}
              onCancel={() => {
                setDraft(null);
                setEditing(false);
              }}
              onDone={() => {
                if (draft) setLayout(draft);
                setDraft(null);
                setEditing(false);
              }}
              onReset={() => {
                reset();
                setDraft(null);
                setEditing(false);
              }}
            />
          </div>
        ) : null}

        <div className="relative z-[1] flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9">
          <div className="min-w-0">
            <p className="label-mono mb-2">Artist overview</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-[40px] sm:leading-[1.05]">
              {activeArtist?.name ?? "No artist"}
            </h1>
            <p className="mt-1.5 text-sm text-text-lo">
              {data ? (
                <>
                  {data.trackCount} track{data.trackCount === 1 ? "" : "s"} ·{" "}
                  {data.spaceCount} space{data.spaceCount === 1 ? "" : "s"}
                  {sinceLabel ? ` · since ${sinceLabel}` : ""}
                </>
              ) : (
                "Everything under this name, across every space."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
            <Stat value={data?.trackCount} label="Tracks" loading={loading} />
            <Stat value={data?.bounceCount} label="Bounces" loading={loading} />
            <Stat
              value={data?.inProgressCount}
              label="In progress"
              tone="amber"
              loading={loading}
            />
            <Stat
              value={data?.releasedCount}
              label="Released"
              loading={loading}
            />
            <Stat
              display={data ? formatHours(data.focusSec) : undefined}
              label="Focus time"
              loading={loading}
            />
          </div>

          <FlareLine className="max-w-[420px] opacity-60" />
        </div>
      </LfWindow>

      {isError ? (
        <section className="panel p-5">
          <p className="text-sm text-warn">
            Couldn’t load this artist’s numbers.{" "}
            {error?.message ?? "Try again in a moment."}
          </p>
        </section>
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="panel h-64 animate-pulse lg:col-span-3" />
          <div className="panel h-64 animate-pulse lg:col-span-2" />
        </div>
      ) : !data?.hasAnything ? (
        <EmptyShaderPanel
          title="Nothing to measure yet"
          copy="Once this artist has tracks, bounces and sessions, this page shows what you’ve built and how you actually work."
          action={
            <Button asChild>
              <Link href="/import">Bring your music in</Link>
            </Button>
          }
        />
      ) : (
        <>
          {editing ? (
            <p className="text-[11px] text-text-lo">
              Drag sections between columns, drop one onto another to combine
              them, or send them to Hidden.
            </p>
          ) : null}

          <ModularWorkspace
            layout={shown}
            modules={modules}
            editing={editing}
            onChange={(next) => (editing ? setDraft(next) : setLayout(next))}
            vocabulary={ALL_ARTIST_MODULE_IDS}
          />
        </>
      )}
    </div>
  );
}

/** Each section of the page as a module the layout engine can place. */
function useArtistModules(
  data: ArtistOverview | undefined
): Partial<Record<ModuleId, React.ReactNode>> {
  const palette = useChartPalette();

  return React.useMemo(() => {
    if (!data) return {};

    const musicSpaceCount = data.spaces.filter(
      (s) => s.space.focus !== "tasks"
    ).length;
    const upcoming = data.releases.filter((r) => !r.isPast);
    const past = data.releases.filter((r) => r.isPast).reverse();

    return {
      output: (
        <section className="panel p-5">
          <SectionHeader label="The year in bounces" />
          <MonthlyOutputChart months={data.monthly} />
        </section>
      ),

      pipeline: (
        <section className="panel p-5">
          <SectionHeader label="Pipeline" count={musicSpaceCount} />
          <PipelineBars pipelines={data.pipelines} />
        </section>
      ),

      momentum: (
        <section className="panel-quiet p-5">
          <SectionHeader label="Momentum" />
          <MomentumBar momentum={data.momentum} ramp={palette.momentum} />
        </section>
      ),

      catalog: (
        <section className="panel-quiet p-5">
          <SectionHeader label="Catalog" />
          <dl className="space-y-2 text-sm">
            <MetaRow
              label="Total listening time"
              value={data.catalogSec > 0 ? formatHours(data.catalogSec) : "—"}
            />
            <MetaRow label="Sessions logged" value={String(data.sessionCount)} />
            <MetaRow label="Spaces" value={String(data.spaceCount)} />
          </dl>
        </section>
      ),

      spaces: (
        <section className="panel p-5">
          <SectionHeader label="Spaces" count={data.spaces.length} />
          <SpacesOverview spaces={data.spaces} />
        </section>
      ),

      sound: (
        <section className="panel p-5">
          <SectionHeader
            label="Your sound"
            aside={
              data.medianBpm ? (
                <span className="text-[11px] text-text-lo">
                  median{" "}
                  <span className="tabular-nums text-text-hi">
                    {data.medianBpm}
                  </span>{" "}
                  BPM
                </span>
              ) : null
            }
          />
          <p className="mb-3 text-[11px] text-text-lo">Tracks by tempo</p>
          <BpmHistogram buckets={data.bpm} medianBpm={data.medianBpm} />

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-[11px] text-text-lo">Keys you write in</p>
              <RankedBars items={data.keys} emptyCopy="No keys recorded yet." />
            </div>
            <div>
              <p className="mb-3 text-[11px] text-text-lo">Genres</p>
              <RankedBars
                items={data.genres}
                emptyCopy="No genres recorded yet."
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-[11px] text-text-lo">Track types</p>
            <RankedBars items={data.types} emptyCopy="No tracks yet." />
          </div>
        </section>
      ),

      rhythm: (
        <section className="panel-quiet p-5">
          <SectionHeader label="Work rhythm" />
          <RhythmHeatmap cells={data.rhythm} max={data.rhythmMax} />
          <dl className="mt-5 space-y-2 text-sm">
            <MetaRow label="Busiest day" value={data.bestDayLabel ?? "—"} />
            <MetaRow label="Busiest hour" value={data.bestHourLabel ?? "—"} />
            <MetaRow
              label="Weeks in a row"
              value={data.streakWeeks > 0 ? String(data.streakWeeks) : "—"}
            />
          </dl>
        </section>
      ),

      releases: (
        <section className="panel-quiet p-5">
          <SectionHeader label="Releases" count={data.releases.length} />
          {data.releases.length === 0 ? (
            <QuietEmpty>
              No release dates set. Give a single, EP or album project a release
              date and the countdown shows up here.
            </QuietEmpty>
          ) : (
            <>
              {upcoming.length > 0 ? (
                <ul className="space-y-1">
                  {upcoming.map((release) => (
                    <li key={release.projectId}>
                      <Link
                        href={`/projects/${release.projectId}`}
                        className="well lift flex items-center gap-3 rounded-input px-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-text-hi">
                          {release.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-text-lo">
                          {release.date}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-amber">
                          {release.daysUntil <= 0
                            ? "today"
                            : `${release.daysUntil}d`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {past.length > 0 ? (
                <>
                  <p className="label-mono mb-2 mt-5">Out in the world</p>
                  <ul className="flex flex-wrap gap-2">
                    {past.map((release) => (
                      <li key={release.projectId}>
                        <Link
                          href={`/projects/${release.projectId}`}
                          className="well lift flex items-center gap-2 rounded-chip px-3 py-1.5 text-[12px] text-text-hi"
                        >
                          {release.name}
                          <span className="text-text-lo">{release.date}</span>
                          {release.liveUrl ? (
                            <ExternalLink className="size-3 text-ice" />
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </section>
      ),

      lingering: (
        <section className="panel p-5">
          <SectionHeader label="Longest in progress" />
          <LingeringList items={data.lingering} />
        </section>
      ),

      feedback: (
        <section className="panel-quiet p-5">
          <SectionHeader label="Feedback received" />
          {data.guestComments + data.ownComments + data.decisionCount === 0 ? (
            <QuietEmpty>
              Nothing yet. Share a bounce with a guest review link and their
              notes land here.
            </QuietEmpty>
          ) : (
            <dl className="space-y-2 text-sm">
              <MetaRow label="From guests" value={String(data.guestComments)} />
              <MetaRow label="Your own notes" value={String(data.ownComments)} />
              <MetaRow
                label="Still open"
                value={String(data.openThreads)}
                tone={data.openThreads > 0 ? "amber" : undefined}
              />
              <MetaRow
                label="Decisions logged"
                value={String(data.decisionCount)}
              />
              <MetaRow label="Approved" value={String(data.approvalCount)} />
            </dl>
          )}
        </section>
      ),
    } satisfies Partial<Record<ModuleId, React.ReactNode>>;
  }, [data, palette]);
}

/** Edit-layout controls, mirroring the track workspace's toolbar. */
function LayoutBar({
  editing,
  onEdit,
  onCancel,
  onDone,
  onReset,
}: {
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDone: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {editing ? (
        <>
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onDone}>
            <Check className="size-3.5" />
            Done
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
          <LayoutGrid className="size-3.5" />
          Edit layout
        </Button>
      )}
    </div>
  );
}

function Stat({
  value,
  display,
  label,
  tone,
  loading,
}: {
  value?: number;
  display?: string;
  label: string;
  tone?: "amber";
  loading?: boolean;
}) {
  const shown = display ?? (value === undefined ? undefined : String(value));
  const muted =
    loading || shown === undefined || shown === "0" || shown === "0m";
  return (
    <div>
      <p
        className={cn(
          "stat-value",
          muted
            ? "text-text-lo/50"
            : tone === "amber"
              ? "text-amber"
              : "text-text-hi"
        )}
      >
        {loading ? "—" : (shown ?? "—")}
      </p>
      <p className="label-mono mt-2">{label}</p>
    </div>
  );
}

function MetaRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-lo">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "amber" ? "text-amber" : "text-text-hi"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
