import { fetchArtistProfile, upsertArtistProfile } from "@/lib/api/artist-profile";
import type { ArtistOriginInterpretation } from "@/lib/origin/types";

/**
 * Optional, opt-in mapping from an Origin story into the artist's *private*
 * profile.
 *
 * The rules here are deliberately timid, because this runs on a checkbox the
 * artist ticked once at the end of a long flow:
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

  const patch: Parameters<typeof upsertArtistProfile>[1] = {};

  // The promise is one or two evocative sentences — the closest match to a tagline.
  const promise = interpretation.artistPromise.trim();
  if (promise && !existing?.tagline) patch.tagline = promise.slice(0, 140);

  // Longer approved prose goes to the bio, and only when there isn't one.
  const compass = interpretation.creativeCompass.trim();
  const chapter = interpretation.currentChapter.premise.trim();
  if (compass && !existing?.bio) patch.bio = compass;

  if (!existing?.sound_markers?.length && interpretation.identitySignals.length) {
    patch.sound_markers = interpretation.identitySignals.slice(0, 5).map((signal) => ({
      label: signal.label,
      description: signal.explanation,
    }));
  }

  if (interpretation.currentChapter.title.trim() && !existing?.current_focus_title) {
    patch.current_focus_title = interpretation.currentChapter.title.trim();
  }
  if (chapter && !existing?.current_focus_body) patch.current_focus_body = chapter;

  if (!existing?.genres?.length && interpretation.suggestedGenres.length) {
    patch.genres = interpretation.suggestedGenres.slice(0, 8);
  }
  if (!existing?.roles?.length && interpretation.suggestedRoles.length) {
    patch.roles = interpretation.suggestedRoles.slice(0, 8);
  }

  if (Object.keys(patch).length === 0) return;

  await upsertArtistProfile(
    artistId,
    patch,
    existing?.display_name || displayName
  );
}
