import type { Confidence } from "@/lib/ai/import-plan-schema";

/**
 * ORIGIN domain types. Mirrors migration 042 — keep the unions in step with the
 * check constraints there.
 */

export type OriginStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "skipped"
  | "legacy_complete";

/**
 * Stable resume points. Deliberately coarser than the experience state machine:
 * a transition is never a resume target, so a refresh mid-transition lands on
 * the loop the artist was heading into.
 */
export type OriginStep =
  | "name"
  | "introduction"
  | "processing"
  | "review"
  | "story"
  | "complete";

export type IdentitySignal = {
  label: string;
  explanation: string;
  /** A concise excerpt or faithful paraphrase of the artist's own words. */
  evidence: string;
  confidence: Confidence;
};

export type OriginStorySection = {
  title: string;
  body: string;
};

/** The interpretation, as returned by the model and as edited by the artist. */
export type ArtistOriginInterpretation = {
  artistPromise: string;
  creativeCompass: string;
  identitySignals: IdentitySignal[];
  currentChapter: {
    title: string;
    premise: string;
  };
  storySections: OriginStorySection[];
  suggestedGenres: string[];
  suggestedRoles: string[];
};

/** The persisted row, camelCased for the client. */
export type ArtistOrigin = {
  artistId: string;
  status: "in_progress" | "complete" | "skipped";
  currentStep: OriginStep;
  artistNameDraft: string | null;
  introductionText: string | null;
  directionText: string | null;
  interpretation: ArtistOriginInterpretation | null;
  generationVersion: number;
  generatedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

/** What a draft save may change. Every field optional — saves are incremental. */
export type OriginDraftPatch = {
  currentStep?: OriginStep;
  artistNameDraft?: string | null;
  introductionText?: string | null;
  directionText?: string | null;
  interpretation?: ArtistOriginInterpretation | null;
};

export const EMPTY_INTERPRETATION: ArtistOriginInterpretation = {
  artistPromise: "",
  creativeCompass: "",
  identitySignals: [],
  currentChapter: { title: "", premise: "" },
  storySections: [],
  suggestedGenres: [],
  suggestedRoles: [],
};

/** Raw database row shape, for the mapping functions. */
export type ArtistOriginRow = {
  artist_id: string;
  status: "in_progress" | "complete" | "skipped";
  current_step: OriginStep;
  artist_name_draft: string | null;
  introduction_text: string | null;
  direction_text: string | null;
  artist_promise: string | null;
  creative_compass: string | null;
  identity_signals: IdentitySignal[] | null;
  current_chapter_title: string | null;
  current_chapter_premise: string | null;
  story_sections: OriginStorySection[] | null;
  suggested_genres: string[] | null;
  suggested_roles: string[] | null;
  generation_version: number;
  generated_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
};

export function rowToOrigin(row: ArtistOriginRow): ArtistOrigin {
  const hasInterpretation =
    Boolean(row.artist_promise) ||
    Boolean(row.creative_compass) ||
    (row.identity_signals?.length ?? 0) > 0 ||
    Boolean(row.current_chapter_title) ||
    Boolean(row.current_chapter_premise) ||
    (row.story_sections?.length ?? 0) > 0;

  return {
    artistId: row.artist_id,
    status: row.status,
    currentStep: row.current_step,
    artistNameDraft: row.artist_name_draft,
    introductionText: row.introduction_text,
    directionText: row.direction_text ?? null,
    interpretation: hasInterpretation
      ? {
          artistPromise: row.artist_promise ?? "",
          creativeCompass: row.creative_compass ?? "",
          identitySignals: row.identity_signals ?? [],
          currentChapter: {
            title: row.current_chapter_title ?? "",
            premise: row.current_chapter_premise ?? "",
          },
          storySections: row.story_sections ?? [],
          suggestedGenres: row.suggested_genres ?? [],
          suggestedRoles: row.suggested_roles ?? [],
        }
      : null,
    generationVersion: row.generation_version,
    generatedAt: row.generated_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
