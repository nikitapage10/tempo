/**
 * Import Studio client API.
 *
 * Unlike the rest of lib/api/*, these go through route handlers rather than
 * straight to Supabase — the AI work needs a server-only key, and the commit
 * runs as a single database transaction.
 */

import type { WorkspaceImportPlan } from "@/lib/ai/import-plan-schema";
import type { CommitSelection } from "@/lib/ai/commit-payload";
import type {
  SpotifyImportTrackMatch,
} from "@/lib/spotify-import-match";
import { buildImportSourcePath, uploadFile } from "@/lib/storage";

export type ImportSourceKind = "text" | "voice" | "image" | "document";

export type ImportSource = {
  id: string;
  kind: ImportSourceKind;
  label: string | null;
  byte_size: number | null;
  mime_type: string | null;
  status: "pending" | "extracting" | "ready" | "failed" | "excluded";
  error: string | null;
  sort: number;
  created_at: string;
  /** For typed notes this is what the artist wrote — shown back in the transcript. */
  extracted_text: string | null;
};

export type ImportSession = {
  id: string;
  status:
    | "draft"
    | "extracting"
    | "synthesizing"
    | "needs_review"
    | "committing"
    | "completed"
    | "failed"
    | "cancelled";
  plan: WorkspaceImportPlan | null;
  summary: Record<string, number> | null;
  error: string | null;
  committedAt: string | null;
  createdAt: string;
};

export type ImportSnapshot = {
  import: ImportSession;
  sources: ImportSource[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || "Something went wrong.");
  }
  return body as T;
}

export async function createImport(): Promise<{ id: string }> {
  const body = await request<{ import: { id: string } }>("/api/import", { method: "POST" });
  return { id: body.import.id };
}

export async function fetchImport(importId: string): Promise<ImportSnapshot> {
  return request<ImportSnapshot>(`/api/import/${importId}`, { method: "GET" });
}

export async function addTextSource(
  importId: string,
  text: string,
  label = "Typed notes",
): Promise<ImportSource> {
  const body = await request<{ source: ImportSource }>(`/api/import/${importId}/sources`, {
    method: "POST",
    body: JSON.stringify({ kind: "text", text, label }),
  });
  return body.source;
}

/**
 * Uploads to private storage first so the bytes never travel through a
 * serverless function body, then registers the path.
 */
export async function addFileSource(
  importId: string,
  file: File,
  kind: Exclude<ImportSourceKind, "text">,
  onProgress?: (percent: number) => void,
): Promise<ImportSource> {
  // A client-side id is enough to key the folder; the row's own id isn't
  // needed until after the upload, and this keeps paths unique.
  const sourceKey = crypto.randomUUID();
  const path = buildImportSourcePath({
    importId,
    sourceId: sourceKey,
    filename: file.name || `${kind}-${sourceKey}`,
  });

  await uploadFile(path, file, { onProgress, contentType: file.type || undefined });

  const body = await request<{ source: ImportSource }>(`/api/import/${importId}/sources`, {
    method: "POST",
    body: JSON.stringify({
      kind,
      label: file.name || null,
      storagePath: path,
      byteSize: file.size,
      mimeType: file.type || null,
    }),
  });
  return body.source;
}

export async function removeSource(importId: string, sourceId: string): Promise<void> {
  await request(`/api/import/${importId}/sources/${sourceId}`, { method: "DELETE" });
}

export type Followup = { question: string; options: string[] };

/**
 * Asks TEMPO what it still needs to know. Never throws — a missing follow-up
 * shouldn't stop someone importing.
 */
export type FollowupResponse = {
  /** What TEMPO says it found, so the artist can see their file was read. */
  observation: string;
  questions: Followup[];
  enoughToProceed: boolean;
};

export async function askFollowups(importId: string): Promise<FollowupResponse> {
  try {
    return await request<FollowupResponse>(`/api/import/${importId}/ask`, {
      method: "POST",
    });
  } catch {
    return { observation: "", questions: [], enoughToProceed: true };
  }
}

export type ExtractProgress = {
  processed: number;
  hasMore: boolean;
  remaining: number;
  warnings: string[];
};

export async function extractOnce(importId: string): Promise<ExtractProgress> {
  return request<ExtractProgress>(`/api/import/${importId}/extract`, { method: "POST" });
}

/** Keeps calling extract until nothing is pending. Each call is a short request. */
export async function extractAll(
  importId: string,
  onTick?: (progress: ExtractProgress) => void,
): Promise<string[]> {
  const warnings: string[] = [];
  // Bounded so a source stuck in "pending" can't spin forever.
  for (let i = 0; i < 20; i += 1) {
    const progress = await extractOnce(importId);
    warnings.push(...progress.warnings);
    onTick?.(progress);
    if (!progress.hasMore) break;
  }
  return warnings;
}

export async function synthesize(
  importId: string,
  answers?: { question: string; answer: string }[],
): Promise<WorkspaceImportPlan> {
  const body = await request<{ plan: WorkspaceImportPlan }>(
    `/api/import/${importId}/synthesize`,
    { method: "POST", body: JSON.stringify({ answers: answers ?? [] }) },
  );
  return body.plan;
}

export type CommitSummary = {
  spaces: number;
  stages: number;
  projects: number;
  tracks: number;
  tasks: number;
  checklistItems: number;
  metadataImported?: number;
  metadataFailed?: number;
  artworkImported?: number;
  artworkFailed?: number;
  alreadyCommitted: boolean;
};

export type SpotifyArtistCandidate = {
  id: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
};

export type SpotifyImportPreview = {
  artist: SpotifyArtistCandidate;
  catalogTrackCount: number;
  matches: SpotifyImportTrackMatch[];
};

export type SpotifyImportSelection = {
  artistId: string;
  artistName: string;
  copyArtwork: boolean;
  matches: { trackRef: string; spotifyTrackId: string }[];
};

export type SpotifyCatalogBootstrap =
  | { found: false }
  | {
      found: true;
      plan: WorkspaceImportPlan;
      preview: SpotifyImportPreview;
    };

export type SpotifyCatalogMatchResult = {
  plan: WorkspaceImportPlan;
  preview: SpotifyImportPreview;
};

export async function bootstrapImportSpotifyCatalog(
  importId: string,
  spaceId: string,
  artistId: string,
): Promise<SpotifyCatalogBootstrap> {
  return request<SpotifyCatalogBootstrap>(`/api/import/${importId}/spotify`, {
    method: "POST",
    body: JSON.stringify({ action: "bootstrap", spaceId, artistId }),
  });
}

export async function searchImportSpotifyArtists(
  importId: string,
  query: string
): Promise<SpotifyArtistCandidate[]> {
  const body = await request<{ results: SpotifyArtistCandidate[] }>(
    `/api/import/${importId}/spotify`,
    {
      method: "POST",
      body: JSON.stringify({ action: "search", query }),
    }
  );
  return body.results;
}

export async function matchImportSpotifyCatalog(
  importId: string,
  artistId: string,
  tracks: { ref: string; title: string }[],
  spaceId: string,
  tempoArtistId: string,
): Promise<SpotifyCatalogMatchResult> {
  return request<SpotifyCatalogMatchResult>(`/api/import/${importId}/spotify`, {
    method: "POST",
    body: JSON.stringify({ action: "match", artistId, tracks, spaceId, tempoArtistId }),
  });
}

export async function commitImport(
  importId: string,
  plan: WorkspaceImportPlan,
  selection: CommitSelection,
  artistId: string,
  spotify: SpotifyImportSelection | null = null,
): Promise<CommitSummary> {
  const body = await request<{ summary: CommitSummary }>(`/api/import/${importId}/commit`, {
    method: "POST",
    body: JSON.stringify({ plan, selection, artistId, spotify }),
  });
  return body.summary;
}

export async function discardImport(importId: string): Promise<void> {
  await request(`/api/import/${importId}`, { method: "DELETE" });
}
