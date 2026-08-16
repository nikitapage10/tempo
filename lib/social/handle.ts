/**
 * Handle rules, in one place.
 *
 * A handle is the artist's address on the network: it is what @mentions
 * resolve to and what /artist/[handle] serves. Because it is the one piece of
 * network identity that has to be unique and cannot be quietly filled in for
 * someone, it is asked for at the moment an artist chooses to be on the
 * network at all, rather than left to be discovered later on a profile screen.
 *
 * The shape checks mirror the `artist_profiles_handle_shape` constraint in
 * migration 028. Duplicating them here is deliberate: a constraint violation
 * arrives as a database error the artist cannot act on, and this way the same
 * wording explains the rule in the form and in the API.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** The wording used everywhere the rule has to be explained. */
export const HANDLE_RULE_HINT =
  "3 to 30 characters: lowercase letters, numbers, underscores or dots, starting and ending with a letter or number.";

const SHAPE = /^[a-z0-9_.]{3,30}$/;

export type HandleCheck = { ok: true; handle: string } | { ok: false; message: string };

/**
 * Normalize what someone typed into the form a handle is stored in.
 *
 * Leading "@" is stripped because people type it, spaces become underscores
 * because that is what they meant, and everything is lowercased because the
 * column is.
 */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function validateHandle(raw: string): HandleCheck {
  const handle = normalizeHandle(raw);
  if (!handle) return { ok: false, message: "Pick a handle to join the network." };
  if (handle.length < HANDLE_MIN) {
    return { ok: false, message: `Handles are at least ${HANDLE_MIN} characters.` };
  }
  if (handle.length > HANDLE_MAX) {
    return { ok: false, message: `Handles are at most ${HANDLE_MAX} characters.` };
  }
  if (!SHAPE.test(handle)) {
    return {
      ok: false,
      message: "Handles use lowercase letters, numbers, underscores and dots only.",
    };
  }
  if (/^[._]/.test(handle) || /[._]$/.test(handle)) {
    return {
      ok: false,
      message: "Handles start and end with a letter or number.",
    };
  }
  return { ok: true, handle };
}

/**
 * A starting point drawn from the name they already gave us.
 *
 * Only ever a suggestion in a field they can overwrite. Nothing here is
 * accepted without the artist seeing it, because the handle is public and
 * permanent enough that having one chosen for them would be a small betrayal.
 * Returns an empty string when the name yields nothing usable, in which case
 * the field simply starts blank.
 */
export function suggestHandle(name: string | null | undefined): string {
  const base = normalizeHandle(name ?? "")
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/^[._]+/, "")
    .replace(/[._]+$/, "")
    .slice(0, HANDLE_MAX);
  return base.length >= HANDLE_MIN ? base : "";
}
