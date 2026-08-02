import type { SpotifyCatalogTrack } from "@/lib/platforms/spotify";

export type SpotifyMatchConfidence = "high" | "medium" | "low";

export type SpotifyImportCandidate = SpotifyCatalogTrack & {
  score: number;
  confidence: SpotifyMatchConfidence;
  reason: string;
};

export type SpotifyImportTrackMatch = {
  trackRef: string;
  tempoTitle: string;
  candidates: SpotifyImportCandidate[];
  selectedTrackId: string | null;
};

const VERSION_WORDS = [
  "acoustic",
  "club mix",
  "demo",
  "edit",
  "extended",
  "instrumental",
  "live",
  "mix",
  "radio edit",
  "remaster",
  "remastered",
  "remix",
  "sped up",
  "stripped",
  "version",
];

function ascii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .toLowerCase();
}

function normalize(value: string): string {
  return ascii(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleParts(value: string): { full: string; base: string; versions: string[] } {
  const raw = ascii(value);
  const versions: string[] = [];
  const withoutGroups = raw.replace(/[\[(]([^\])]+)[\])]/g, (all, content: string) => {
    const normalized = normalize(content);
    if (VERSION_WORDS.some((word) => normalized.includes(word))) {
      versions.push(normalized);
      return " ";
    }
    if (/\b(feat|featuring|ft|with)\b/.test(normalized)) return " ";
    return all;
  });
  const base = normalize(
    withoutGroups.replace(/\s+(?:feat(?:uring)?|ft|with)\.?\s+.+$/i, "")
  );
  return { full: normalize(value), base, versions: versions.sort() };
}

function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

function versionAgreement(a: string[], b: string[]): "same" | "missing" | "conflict" {
  if (a.length === 0 && b.length === 0) return "same";
  if (a.length === 0 || b.length === 0) return "missing";
  return a.join("|") === b.join("|") ? "same" : "conflict";
}

function scoreCandidate(tempoTitle: string, candidate: SpotifyCatalogTrack) {
  const tempo = titleParts(tempoTitle);
  const spotify = titleParts(candidate.title);
  const versions = versionAgreement(tempo.versions, spotify.versions);

  let score: number;
  let reason: string;
  if (tempo.full === spotify.full) {
    score = 1;
    reason = "Exact title match";
  } else if (tempo.base === spotify.base && versions === "same") {
    score = 0.97;
    reason = "Same title and version";
  } else if (tempo.base === spotify.base && versions === "missing") {
    score = 0.86;
    reason = "Same title; check the version";
  } else if (tempo.base === spotify.base) {
    score = 0.6;
    reason = "Same song title, different version";
  } else {
    score = similarity(tempo.base, spotify.base) * 0.82;
    reason = "Similar title";
  }

  // When Spotify has the same recording on a single and an album, prefer the
  // single artwork while still showing the album alternative for review.
  if (candidate.album.type === "single") score += 0.015;
  if (normalize(candidate.album.name) === spotify.base) score += 0.01;
  score = Math.min(1, score);

  const confidence: SpotifyMatchConfidence =
    score >= 0.92 ? "high" : score >= 0.72 ? "medium" : "low";
  return { score, confidence, reason };
}

export function matchSpotifyCatalog(
  tracks: { ref: string; title: string }[],
  catalog: SpotifyCatalogTrack[]
): SpotifyImportTrackMatch[] {
  return tracks.map((track) => {
    const candidates = catalog
      .map((candidate) => ({ ...candidate, ...scoreCandidate(track.title, candidate) }))
      .filter((candidate) => candidate.score >= 0.42)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.album.releaseDate ?? "").localeCompare(a.album.releaseDate ?? "");
      })
      .slice(0, 5);
    const best = candidates[0];
    return {
      trackRef: track.ref,
      tempoTitle: track.title,
      candidates,
      selectedTrackId:
        best && (best.confidence === "high" || best.confidence === "medium")
          ? best.id
          : null,
    };
  });
}
