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
 *  - Genres and roles are not written here at all — those need their own
 *    confirmation, so they stay in the Origin record until the artist asks.
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

  const patch: Record<string, string> = {};

  // The promise is one or two evocative sentences — the closest match to a tagline.
  const promise = interpretation.artistPromise.trim();
  if (promise && !existing?.tagline) patch.tagline = promise.slice(0, 200);

  // Longer approved prose goes to the bio, and only when there isn't one.
  const compass = interpretation.creativeCompass.trim();
  const chapter = interpretation.currentChapter.premise.trim();
  const longForm = [compass, chapter].filter(Boolean).join("\n\n");
  if (longForm && !existing?.bio) patch.bio = longForm;

  if (Object.keys(patch).length === 0) return;

  await upsertArtistProfile(
    artistId,
    patch,
    existing?.display_name || displayName
  );
}
