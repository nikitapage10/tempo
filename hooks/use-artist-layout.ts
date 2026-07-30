"use client";

import * as React from "react";
import {
  clearArtistLayout,
  readArtistLayout,
  sanitizeArtistLayout,
  writeArtistLayout,
} from "@/lib/artist-layout";
import {
  DEFAULT_ARTIST_LAYOUT,
  type ModuleLayout,
} from "@/lib/workspace-presets";

/**
 * The artist overview's saved arrangement, per artist.
 *
 * Reads on mount rather than during render so server and first client paint
 * agree; until then the default layout shows, which is also what a new artist
 * gets, so there is no visible swap for anyone who hasn't customised.
 */
export function useArtistLayout(artistId: string | null) {
  const [layout, setLayout] = React.useState<ModuleLayout>(
    DEFAULT_ARTIST_LAYOUT
  );
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!artistId) return;
    setLayout(readArtistLayout(artistId) ?? DEFAULT_ARTIST_LAYOUT);
    setLoaded(true);
  }, [artistId]);

  const save = React.useCallback(
    (next: ModuleLayout) => {
      // Sanitize only — never re-add absent modules here, or hiding one would
      // be undone the moment it is saved.
      const clean = sanitizeArtistLayout(next);
      setLayout(clean);
      if (artistId) writeArtistLayout(artistId, clean);
    },
    [artistId]
  );

  const reset = React.useCallback(() => {
    setLayout(DEFAULT_ARTIST_LAYOUT);
    if (artistId) clearArtistLayout(artistId);
  }, [artistId]);

  return { layout, setLayout: save, reset, loaded };
}
