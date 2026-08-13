"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ExternalLink, LayoutGrid, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
import {
  AppleModule,
  SoundCloudModule,
  SpotifyModule,
} from "@/components/artist/platform-modules";
import { CustomModuleCard } from "@/components/artist/custom-stats";
import { AttributeSheet } from "@/components/artist/attribute-sheet";
import { PerformanceList } from "@/components/artist/performances/performance-list";
import { AchievementList } from "@/components/gamification/achievement-list";
import { ModularWorkspace } from "@/components/track/modular-workspace";
import { sanitizeArtistLayout, type GamificationPreference } from "@/lib/artist-layout";
import {
  useCustomModuleMutations,
  useCustomModules,
} from "@/hooks/use-custom-stats";
import type { CustomStatModule } from "@/lib/api/custom-stats";
import {
  ALL_ARTIST_MODULE_IDS,
  ARTIST_LAYOUT_TEMPLATES,
  customModuleId,
  type ArtistLayoutTemplate,
  type ModuleId,
  type ModuleLayout,
} from "@/lib/workspace-presets";
import { formatHours, type ArtistOverview } from "@/lib/artist-stats";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

// Stable reference so a still-loading query doesn't churn memo deps every render.
const NO_CUSTOM_MODULES: CustomStatModule[] = [];

/** Strips one module id out of both columns — used when a custom module is deleted. */
function stripModuleId(layout: ModuleLayout, id: ModuleId): ModuleLayout {
  const drop = (slots: ModuleId[][]) =>
    slots.map((s) => s.filter((m) => m !== id)).filter((s) => s.length > 0);
  return { ...layout, left: drop(layout.left), right: drop(layout.right) };
}

export default function ArtistStatsPage() {
  const { activeArtist, isLoading: artistLoading } = useActiveArtist();
  const { data, isLoading, isError, error } = useArtistStats(
    activeArtist?.id ?? null
  );
  const { layout, setLayout, gamification, setGamification, reset } = useArtistLayout(
    activeArtist?.id ?? null
  );

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ModuleLayout | null>(null);

  const loading = artistLoading || isLoading;
  const shown = editing ? (draft ?? layout) : layout;

  const customModules =
    useCustomModules(activeArtist?.id ?? null).data ?? NO_CUSTOM_MODULES;
  const customModuleMutations = useCustomModuleMutations(
    activeArtist?.id ?? null
  );

  function handleModuleDeleted(dbId: string) {
    const id = customModuleId(dbId);
    setLayout(stripModuleId(layout, id));
    setDraft((prev) => (prev ? stripModuleId(prev, id) : prev));
  }

  async function handleCreateModule(title: string) {
    const created = await customModuleMutations.addModule.mutateAsync({
      title,
      sortOrder: customModules.length,
    });
    const id = customModuleId(created.id);
    setDraft((prev) => {
      const base = prev ?? layout;
      return { ...base, right: [...base.right, [id]] };
    });
  }

  const vocabulary = React.useMemo(
    () => [
      ...ALL_ARTIST_MODULE_IDS,
      ...customModules.map((m) => customModuleId(m.id)),
    ],
    [customModules]
  );
  const labelOverrides = React.useMemo(
    () =>
      Object.fromEntries(
        customModules.map((m) => [customModuleId(m.id), m.title])
      ) as Partial<Record<ModuleId, string>>,
    [customModules]
  );

  const sinceLabel = data?.firstActivityAt
    ? new Date(data.firstActivityAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const modules = useArtistModules(
    data,
    activeArtist,
    customModules,
    handleModuleDeleted,
    gamification,
    setGamification
  );

  return (
    <div className="space-y-5">
      {/* Identity hero — glass shell; inner field window restores Spectra. */}
      <div className="glass-hero prism-edge relative overflow-hidden">
        <div className="absolute inset-0">
          <LfWindow field className="absolute inset-0" aria-hidden />
          {activeArtist ? (
            <ArtistBanner
              artist={activeArtist}
              fadeRight
              className="absolute inset-0"
            />
          ) : null}
          <div className="scrim-reveal absolute inset-0" aria-hidden />
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
            <p className="label-mono mb-2">Stats</p>
            <h1 className="font-display text-3xl font-medium tracking-[0.025em] text-text-hi sm:text-[40px] sm:leading-[1.05]">
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

          {/* Trimmed to the figures nothing below repeats — Bounces and In
              progress reappear in Output and Pipeline right underneath, so
              they stayed out of the hero to stop the page saying the same
              thing twice before it's said anything else. */}
          <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
            <Stat value={data?.trackCount} label="Tracks" loading={loading} />
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
      </div>

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
            <ArtistTemplatePicker
              onApply={(t) => setDraft(sanitizeArtistLayout(t.layout))}
              onCreateModule={handleCreateModule}
            />
          ) : null}

          <ModularWorkspace
            layout={shown}
            modules={modules}
            editing={editing}
            onChange={(next) => (editing ? setDraft(next) : setLayout(next))}
            vocabulary={vocabulary}
            labelOverrides={labelOverrides}
          />
        </>
      )}
    </div>
  );
}

/** Each section of the page as a module the layout engine can place. */
function useArtistModules(
  data: ArtistOverview | undefined,
  artist: Artist | null,
  customModules: CustomStatModule[],
  onCustomModuleDeleted: (dbId: string) => void,
  gamification: GamificationPreference,
  onGamificationChange: (next: GamificationPreference) => void
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
      // Feature tier: the page's leading module. Wider padding and the same
      // prism-edge treatment as the hero, so it reads as the page's anchor
      // rather than one more panel — this is the slot the attribute sheet
      // (gamification) takes over once it exists.
      output: (
        <section className="panel prism-edge p-6">
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

      // Compact tier: catalog + feedback merged into one small module instead
      // of two panels that were each three to five rows in a full-size card.
      signals: (
        <section className="panel-quiet p-4">
          <p className="label-mono mb-3">Signals</p>
          <dl className="space-y-2 text-sm">
            <MetaRow
              label="Total listening time"
              value={data.catalogSec > 0 ? formatHours(data.catalogSec) : "—"}
            />
            <MetaRow label="Sessions logged" value={String(data.sessionCount)} />
            <MetaRow label="Spaces" value={String(data.spaceCount)} />
            {data.guestComments + data.ownComments + data.decisionCount === 0 ? (
              <MetaRow label="Feedback received" value="—" />
            ) : (
              <>
                <MetaRow
                  label="Feedback received"
                  value={String(data.guestComments + data.ownComments)}
                />
                <MetaRow
                  label="Still open"
                  value={String(data.openThreads)}
                  tone={data.openThreads > 0 ? "amber" : undefined}
                />
                <MetaRow label="Approved" value={String(data.approvalCount)} />
              </>
            )}
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
                <span className="text-xs text-text-lo">
                  median{" "}
                  <span className="tabular-nums text-text-hi">
                    {data.medianBpm}
                  </span>{" "}
                  BPM
                </span>
              ) : null
            }
          />
          <p className="mb-3 text-xs text-text-lo">Tracks by tempo</p>
          <BpmHistogram buckets={data.bpm} medianBpm={data.medianBpm} />

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs text-text-lo">Keys you write in</p>
              <RankedBars items={data.keys} emptyCopy="No keys recorded yet." />
            </div>
            <div>
              <p className="mb-3 text-xs text-text-lo">Genres</p>
              <RankedBars
                items={data.genres}
                emptyCopy="No genres recorded yet."
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-xs text-text-lo">Track types</p>
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
                        <span className="shrink-0 text-xs text-text-lo">
                          {release.date}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-amber">
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

      // Platform modules only exist once there's an artist row to link them to.
      spotify: artist ? <SpotifyModule artist={artist} /> : null,
      soundcloud: artist ? <SoundCloudModule artist={artist} /> : null,
      apple: artist ? <AppleModule artist={artist} /> : null,

      // Gamification (stream 2) — personal only, never shown on the public
      // profile. "off" is handled upstream: the module simply isn't placed.
      attributes: artist ? (
        <AttributeSheet
          artist={artist}
          trackCount={data.trackCount}
          display={gamification.display}
          onDisplayChange={(display) => onGamificationChange({ display })}
        />
      ) : null,
      achievements: artist ? (
        <section className="panel-quiet p-5">
          <SectionHeader label="Achievements" />
          <AchievementList artistId={artist.id} />
        </section>
      ) : null,
      live: artist ? (
        <section className="panel-quiet p-5">
          <SectionHeader label="Live" />
          <PerformanceList
            artistId={artist.id}
            spaces={data.spaces.map((s) => s.space)}
          />
        </section>
      ) : null,
      ...(artist
        ? (Object.fromEntries(
            customModules.map((m) => [
              customModuleId(m.id),
              <CustomModuleCard
                key={m.id}
                artistId={artist.id}
                module={m}
                quiet
                onDeleted={onCustomModuleDeleted}
              />,
            ])
          ) as Partial<Record<ModuleId, React.ReactNode>>)
        : {}),
    } satisfies Partial<Record<ModuleId, React.ReactNode>>;
  }, [
    data,
    palette,
    artist,
    customModules,
    onCustomModuleDeleted,
    gamification,
    onGamificationChange,
  ]);
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

/** Template picker shown while editing the artist overview's layout. */
function ArtistTemplatePicker({
  onApply,
  onCreateModule,
}: {
  onApply: (template: ArtistLayoutTemplate) => void;
  onCreateModule: (title: string) => Promise<void>;
}) {
  const [naming, setNaming] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onCreateModule(title.trim());
      setTitle("");
      setNaming(false);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t create that module."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-quiet p-3">
      <p className="label-mono mb-2">Start from a template</p>
      <div className="flex flex-wrap gap-1.5">
        {ARTIST_LAYOUT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t)}
            title={t.description}
            className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo transition-colors duration-hover hover:border-ice/50 hover:text-text-hi"
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-lo">
        Drag sections between columns, drop one onto another to combine them,
        or send them to Hidden. This layout is yours only — collaborators
        keep their own.
      </p>

      <div className="mt-3 border-t border-line/70 pt-3">
        <p className="label-mono mb-2">Track something of your own</p>
        {naming ? (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
              maxLength={60}
              placeholder="Module name, e.g. Merch"
              className="h-7 w-48 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />
            <Button type="submit" size="sm" disabled={busy || !title.trim()}>
              {busy ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setNaming(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:border-ice/50 hover:bg-ice/10"
          >
            <LayoutGrid className="size-3" />
            New custom module
          </button>
        )}
        <p className="mt-2 text-xs text-text-lo">
          A blank module for whatever isn’t covered above — sync placements,
          merch sold, radio spins. It lands in the right column here; add and
          log stats from the card itself once you’re done editing.
        </p>
      </div>
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
