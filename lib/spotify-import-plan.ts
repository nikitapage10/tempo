import type { WorkspaceImportPlan, Inferred } from "@/lib/ai/import-plan-schema";
import type { SpotifyImportPreview } from "@/lib/api/onboarding-imports";
import type { SpotifyCatalogTrack, SpotifyArtistIdentity } from "@/lib/platforms/spotify";
import type { Momentum, TrackType } from "@/lib/types";

type ExistingTrack = { title: string };

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bfeat\.?\b|\bft\.?\b|\bwith\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferred<T>(
  value: T | null,
  sourceIds: string[],
  reason: string,
): Inferred<T> {
  return {
    value,
    confidence: value == null ? "medium" : "high",
    sourceIds,
    reasoningSummary: reason,
  };
}

function trackType(track: SpotifyCatalogTrack): TrackType {
  const title = track.title.toLowerCase();
  if (/\bremix\b/.test(title)) return "remix";
  if (/\bedit\b/.test(title)) return "edit";
  return "original";
}

function preferCatalogTrack(
  current: SpotifyCatalogTrack,
  candidate: SpotifyCatalogTrack,
): SpotifyCatalogTrack {
  if (current.album.type !== "single" && candidate.album.type === "single") {
    return candidate;
  }
  return (candidate.album.releaseDate ?? "") > (current.album.releaseDate ?? "")
    ? candidate
    : current;
}

/** One TEMPO track per released song title, preferring its single artwork. */
function distinctReleasedTracks(catalog: SpotifyCatalogTrack[]): SpotifyCatalogTrack[] {
  const byTitle = new Map<string, SpotifyCatalogTrack>();
  for (const track of catalog) {
    const key = normalizeTitle(track.title) || track.id;
    const current = byTitle.get(key);
    byTitle.set(key, current ? preferCatalogTrack(current, track) : track);
  }
  return Array.from(byTitle.values()).sort((a, b) =>
    (b.album.releaseDate ?? "").localeCompare(a.album.releaseDate ?? "") ||
    a.title.localeCompare(b.title)
  );
}

export function buildSpotifyCatalogImport(args: {
  artist: SpotifyArtistIdentity & { id: string };
  catalog: SpotifyCatalogTrack[];
  sourceId: string | null;
  space: { id: string; name: string; stageNames: string[] };
  existingTracks: ExistingTrack[];
}): { plan: WorkspaceImportPlan; preview: SpotifyImportPreview } {
  const { artist, sourceId, space } = args;
  const sourceIds = sourceId ? [sourceId] : [];
  const reason = `From ${artist.name}'s confirmed Spotify catalog.`;
  const releasedStage =
    space.stageNames.find((name) => name.toLowerCase() === "released") ?? null;
  const existingTitles = new Map(
    args.existingTracks.map((track) => [normalizeTitle(track.title), track.title])
  );
  const catalog = distinctReleasedTracks(args.catalog);

  const newCatalog = catalog.filter(
    (track) => !existingTitles.has(normalizeTitle(track.title))
  );
  const tracks = newCatalog.map((track) => {
    const ref = `spotify_${track.id}`;
    const otherArtists = track.artists
      .filter((credit) => credit.id !== artist.id)
      .map((credit) => credit.name);
    return {
      ref,
      title: track.title,
      spaceRef: "spotify_space",
      projectRef: null,
      type: inferred<TrackType>(trackType(track), sourceIds, reason),
      stageName: inferred<string>(releasedStage, sourceIds, reason),
      momentum: inferred<Momentum>("parked", sourceIds, reason),
      artistAlias: inferred<string>(artist.name, sourceIds, reason),
      bpm: inferred<number>(null, sourceIds, "Spotify does not provide BPM here."),
      musicalKey: inferred<string>(null, sourceIds, "Spotify does not provide key here."),
      genre: inferred<string>(null, sourceIds, "Spotify does not provide track genre here."),
      destination: inferred<string>(null, sourceIds, "No destination was provided."),
      deadline: inferred<string>(null, sourceIds, "This track is already released."),
      nextAction: inferred<string>(null, sourceIds, "This track is already released."),
      nextActionDue: inferred<string>(null, sourceIds, "This track is already released."),
      blockedReason: inferred<string>(null, sourceIds, "No blocker was provided."),
      waitingOn: inferred<string>(null, sourceIds, "No waiting contact was provided."),
      tags: ["released"],
      notes: track.album.name ? `Released on ${track.album.name}.` : null,
      checklist: [],
      collaborators: otherArtists,
      confidence: "high" as const,
      sourceIds,
      possibleDuplicateOf: null,
    };
  });

  const preview: SpotifyImportPreview = {
    artist: {
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      url: artist.url,
    },
    catalogTrackCount: args.catalog.length,
    matches: catalog.map((track) => ({
      trackRef: `spotify_${track.id}`,
      tempoTitle: track.title,
      candidates: [
        {
          ...track,
          score: 1,
          confidence: "high" as const,
          reason: "From the confirmed artist catalog",
        },
      ],
      selectedTrackId: track.id,
    })),
  };

  return {
    plan: {
      spaces: [
        {
          ref: "spotify_space",
          name: space.name,
          existingId: space.id,
          reasoningSummary: "Your active music space.",
        },
      ],
      projects: [],
      tracks,
      tasks: [],
      questions: [],
      warnings: [],
      overview: `Found ${catalog.length} released track${catalog.length === 1 ? "" : "s"} on ${artist.name}'s Spotify profile. ${tracks.length} ${tracks.length === 1 ? "is" : "are"} new to this TEMPO catalog.`,
    },
    preview,
  };
}
