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
 * Kept in localStorage rather than the database: it is a per-person view
 * preference with no collaboration story, and storing it locally means the
 * page ships without a migration anyone has to run by hand. Track workspace
 * layouts stay in Postgres because they resolve across track/stage/global
 * scopes — this one has a single scope, the artist.
 */

const KEY_PREFIX = "tempo.artistLayout.";

function keyFor(artistId: string): string {
  return `${KEY_PREFIX}${artistId}`;
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
type StoredLayout = {
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

export function readArtistLayout(artistId: string): ModuleLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(artistId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredLayout | ModuleLayout;
    const stored: ModuleLayout =
      "layout" in parsed ? parsed.layout : (parsed as ModuleLayout);
    if (!Array.isArray(stored?.left) || !Array.isArray(stored?.right)) {
      return null;
    }

    const layout = sanitizeArtistLayout(stored);

    // Only modules that did not exist when this layout was saved get added
    // back; anything the user hid stays hidden.
    const knownWhenSaved = new Set<ModuleId>(
      "known" in parsed && Array.isArray(parsed.known)
        ? parsed.known
        : ALL_ARTIST_MODULE_IDS
    );
    const placed = new Set(flattenLayout(layout));
    for (const id of ALL_ARTIST_MODULE_IDS) {
      if (!placed.has(id) && !knownWhenSaved.has(id)) {
        layout.right.push([id]);
      }
    }

    return layout;
  } catch {
    return null;
  }
}

export function writeArtistLayout(artistId: string, layout: ModuleLayout) {
  try {
    const payload: StoredLayout = {
      v: 1,
      layout,
      known: ALL_ARTIST_MODULE_IDS,
    };
    localStorage.setItem(keyFor(artistId), JSON.stringify(payload));
  } catch {
    /* quota or private mode — the layout just doesn't persist */
  }
}

export function clearArtistLayout(artistId: string) {
  try {
    localStorage.removeItem(keyFor(artistId));
  } catch {
    /* ignore */
  }
}
