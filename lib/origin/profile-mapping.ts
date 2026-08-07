import { fetchArtistProfile, upsertArtistProfile } from "@/lib/api/artist-profile";
import type { ArtistOriginInterpretation } from "@/lib/origin/types";
import { sanitizeInterpretation } from "@/lib/origin/validation";

/**
 * Maps the artist-confirmed Origin reading into still-empty profile fields.
 *
 * The rules here are deliberately timid:
 *
 *  - Only empty fields are filled. Existing copy is never replaced.
 *  - `visibility` is never passed, so publication state cannot change.
 *  - Handle, location, pronouns, links and messaging settings are never touched.
 *  - The artist has already edited and confirmed the Origin reading before
 *    this runs. Structured profile fields are still filled only when empty.
 *
 * A failure is swallowed by the caller: the artist has already completed Origin
 * and must not be blocked from entering TEMPO by an optional profile nicety.
 */
export async function applyOriginToProfile(
  artistId: string,
  interpretation: ArtistOriginInterpretation,
  /** Only used if the profile row doesn't exist yet — never renames one. */
  displayName: string
): Promise<void> {
  const existing = await fetchArtistProfile(artistId);
  const clean = sanitizeInterpretation(interpretation);

  const patch: Parameters<typeof upsertArtistProfile>[1] = {};

  // The promise is one or two evocative sentences — the closest match to a tagline.
  const promise = clean.artistPromise.trim();
  if (promise && !existing?.tagline) patch.tagline = promise.slice(0, 140);

  // Longer approved prose goes to the bio, and only when there isn't one.
  const compass = clean.creativeCompass.trim();
  const chapter = clean.currentChapter.premise.trim();
  if (compass && !existing?.bio) patch.bio = compass;

  if (!existing?.sound_markers?.length && clean.identitySignals.length) {
    patch.sound_markers = clean.identitySignals.slice(0, 5).map((signal) => ({
      label: signal.label,
      description: signal.explanation,
    }));
  }

  if (clean.currentChapter.title.trim() && !existing?.current_focus_title) {
    patch.current_focus_title = clean.currentChapter.title.trim();
  }
  if (chapter && !existing?.current_focus_body) patch.current_focus_body = chapter;

  if (!existing?.story_sections?.length && clean.storySections.length) {
    patch.story_sections = clean.storySections;
  }

  if (!existing?.genres?.length && clean.suggestedGenres.length) {
    patch.genres = clean.suggestedGenres.slice(0, 8);
  }
  if (!existing?.roles?.length && clean.suggestedRoles.length) {
    patch.roles = clean.suggestedRoles.slice(0, 8);
  }

  if (Object.keys(patch).length === 0) return;

  await upsertArtistProfile(
    artistId,
    patch,
    existing?.display_name || displayName
  );
}
