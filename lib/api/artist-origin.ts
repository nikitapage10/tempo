import { createClient } from "@/lib/supabase/client";
import {
  rowToOrigin,
  type ArtistOrigin,
  type ArtistOriginInterpretation,
  type ArtistOriginRow,
  type OriginDraftPatch,
} from "@/lib/origin/types";
import { sanitizeInterpretation } from "@/lib/origin/validation";

/**
 * Client-side access to a single artist's Origin row.
 *
 * Every call is scoped by RLS to the caller's own artists (migration 042), so
 * there is no artist_id the browser can pass that reaches another account.
 */

export async function fetchArtistOrigin(artistId: string): Promise<ArtistOrigin | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_origins")
    .select("*")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrigin(data as ArtistOriginRow) : null;
}

/**
 * Incremental draft save. Upserts so the first save creates the row, and only
 * writes the fields the caller actually touched — a name save must not blank
 * out a transcript saved a moment earlier.
 */
export async function saveOriginDraft(
  artistId: string,
  patch: OriginDraftPatch
): Promise<ArtistOrigin> {
  const supabase = createClient();

  const row: Record<string, unknown> = { artist_id: artistId };
  if (patch.currentStep !== undefined) row.current_step = patch.currentStep;
  if (patch.artistNameDraft !== undefined) row.artist_name_draft = patch.artistNameDraft;
  if (patch.introductionText !== undefined) row.introduction_text = patch.introductionText;

  if (patch.interpretation !== undefined) {
    const i = patch.interpretation;
    if (i === null) {
      row.artist_promise = null;
      row.creative_compass = null;
      row.identity_signals = [];
      row.current_chapter_title = null;
      row.current_chapter_premise = null;
      row.suggested_genres = [];
      row.suggested_roles = [];
    } else {
      const clean = sanitizeInterpretation(i);
      row.artist_promise = clean.artistPromise;
      row.creative_compass = clean.creativeCompass;
      row.identity_signals = clean.identitySignals;
      row.current_chapter_title = clean.currentChapter.title;
      row.current_chapter_premise = clean.currentChapter.premise;
      row.suggested_genres = clean.suggestedGenres;
      row.suggested_roles = clean.suggestedRoles;
    }
  }

  const { data, error } = await supabase
    .from("artist_origins")
    .upsert(row, { onConflict: "artist_id" })
    .select()
    .single();
  if (error) throw error;

  // First meaningful save moves the artist out of not_started, so a refresh
  // resumes here rather than replaying the opening.
  await supabase
    .from("artists")
    .update({ origin_status: "in_progress" })
    .eq("id", artistId)
    .eq("origin_status", "not_started");

  return rowToOrigin(data as ArtistOriginRow);
}

/**
 * Final save. Runs the whole thing as one transaction in the database and is
 * safe to call twice — see complete_artist_origin in migration 042.
 */
export async function completeArtistOrigin(input: {
  artistId: string;
  artistName: string;
  introduction: string;
  interpretation: ArtistOriginInterpretation;
}): Promise<ArtistOrigin> {
  const supabase = createClient();
  const clean = sanitizeInterpretation(input.interpretation);

  const { data, error } = await supabase.rpc("complete_artist_origin", {
    p_artist_id: input.artistId,
    p_artist_name: input.artistName,
    p_introduction: input.introduction,
    p_artist_promise: clean.artistPromise,
    p_creative_compass: clean.creativeCompass,
    p_identity_signals: clean.identitySignals,
    p_chapter_title: clean.currentChapter.title,
    p_chapter_premise: clean.currentChapter.premise,
    p_suggested_genres: clean.suggestedGenres,
    p_suggested_roles: clean.suggestedRoles,
  });
  if (error) throw error;
  return rowToOrigin(data as ArtistOriginRow);
}

export async function skipArtistOrigin(artistId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("skip_artist_origin", { p_artist_id: artistId });
  if (error) throw error;
}

/** Server-side interpretation. The model and the key never touch the browser. */
export async function requestInterpretation(input: {
  artistId: string;
  artistName: string;
  introduction: string;
}): Promise<ArtistOriginInterpretation> {
  const res = await fetch("/api/artist-origin/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as
    | { interpretation?: unknown; error?: string }
    | null;
  if (!res.ok) throw new Error(body?.error || "TEMPO couldn't read that just now.");
  return sanitizeInterpretation(body?.interpretation);
}
