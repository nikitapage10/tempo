"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { artistThemeCssVars } from "@/lib/artist-theme";

/**
 * Applies the active artist's palette as inline custom properties on <html>.
 *
 * It has to be <html> rather than a wrapping <div>: Radix dialogs and
 * dropdowns portal to document.body, outside any wrapper, so they'd miss the
 * override. Inline styles on the root element reach everything and beat the
 * `:root` rule in globals.css on specificity.
 *
 * The default "spectra" preset is numerically identical to those globals, so
 * an artist who never picks a palette renders exactly as TEMPO does today.
 */
export function ArtistThemeProvider({ children }: { children: React.ReactNode }) {
  const { activeArtist } = useActiveArtist();
  const paletteId = activeArtist?.palette_id;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = artistThemeCssVars(paletteId);
    Object.entries(vars).forEach(([key, value]) =>
      root.style.setProperty(key, value)
    );
    return () =>
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
  }, [paletteId]);

  return <>{children}</>;
}
