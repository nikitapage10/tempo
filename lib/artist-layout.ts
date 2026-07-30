import {
  ALL_ARTIST_MODULE_IDS,
  clampLeftPct,
  customModuleDbId,
  flattenLayout,
  type ModuleId,
  type ModuleLayout,
} from "@/lib/workspace-presets";

/**
 * Personal arrangement of the artist overview.
 *
 * Lives in Supabase (migration 027), scoped to the signed-in user and the
 * artist — so it follows you to another device instead of staying stuck to
 * one browser. It used to be localStorage-only; `LEGACY_KEY_PREFIX` below is
 * only for reading that old value once, to migrate it into the database
 * instead of silently losing it.
 */

const LEGACY_KEY_PREFIX = "tempo.artistLayout.";

function legacyKeyFor(artistId: string): string {
  return `${LEGACY_KEY_PREFIX}${artistId}`;
}

const KNOWN = new Set<ModuleId>(ALL_ARTIST_MODULE_IDS);

/**
 * What actually goes in storage.
 *
 * `known` records the module vocabulary the layout was saved against. That is
 * what separates "the user hid this" from "this module didn't exist yet":
 * both are absent from the layout, but only the latter should be re-added on
 * read. Without it, hiding a section would be undone by the next save.
 */
export type StoredArtistLayout = {
  v: 1;
  layout: ModuleLayout;
  known: ModuleId[];
};

/**
 * `custom:<id>` modules aren't in the static vocabulary above — they're
 * created per-artist at runtime — so they'd otherwise look unknown and get
 * stripped by `cleanSlots` on every read and save.
 */
function isKnownArtistModule(id: ModuleId): boolean {
  return KNOWN.has(id) || customModuleDbId(id) !== null;
}

function cleanSlots(slots: ModuleId[][]): ModuleId[][] {
  return slots
    .map((slot) => slot.filter((id) => isKnownArtistModule(id)))
    .filter((slot) => slot.length > 0);
}

/** Drop ids this build no longer has; leave deliberate omissions alone. */
export function sanitizeArtistLayout(layout: ModuleLayout): ModuleLayout {
  return {
    left: cleanSlots(layout.left),
    right: cleanSlots(layout.right),
    leftPct: clampLeftPct(layout.leftPct),
  };
}

export function buildStoredArtistLayout(layout: ModuleLayout): StoredArtistLayout {
  return { v: 1, layout, known: ALL_ARTIST_MODULE_IDS };
}

/**
 * Turns a raw stored value (old localStorage shape or the new database
 * column, both the same JSON) into a layout safe to render, re-adding only
 * modules that didn't exist yet when it was saved.
 */
export function reconcileStoredArtistLayout(raw: unknown): ModuleLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<StoredArtistLayout> & Partial<ModuleLayout>;
  const stored: ModuleLayout | undefined =
    "layout" in parsed && parsed.layout ? parsed.layout : (parsed as ModuleLayout);
  if (!stored || !Array.isArray(stored.left) || !Array.isArray(stored.right)) {
    return null;
  }

  const layout = sanitizeArtistLayout(stored);

  const knownWhenSaved = new Set<ModuleId>(
    Array.isArray(parsed.known) ? parsed.known : ALL_ARTIST_MODULE_IDS
  );
  const placed = new Set(flattenLayout(layout));
  for (const id of ALL_ARTIST_MODULE_IDS) {
    if (!placed.has(id) && !knownWhenSaved.has(id)) {
      layout.right.push([id]);
    }
  }

  return layout;
}

/** One-time read of the pre-migration 027 localStorage value, for carrying it into the database. */
export function readLegacyLocalArtistLayout(artistId: string): ModuleLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(legacyKeyFor(artistId));
    if (!raw) return null;
    return reconcileStoredArtistLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearLegacyLocalArtistLayout(artistId: string) {
  try {
    localStorage.removeItem(legacyKeyFor(artistId));
  } catch {
    /* ignore */
  }
}
