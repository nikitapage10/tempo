"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { artistThemeCssVars, resolveArtistHues } from "@/lib/artist-theme";
import { setPaletteFromHues } from "@/lib/lightfield";

/**
 * Applies the active artist's palette as inline custom properties on <html>
 * and pushes the same ice/amber into the root lightfield shader.
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
  const iceColor = activeArtist?.ice_color;
  const amberColor = activeArtist?.amber_color;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const overrides = { ice: iceColor, amber: amberColor };
    const vars = artistThemeCssVars(paletteId, overrides);
    Object.entries(vars).forEach(([key, value]) =>
      root.style.setProperty(key, value)
    );
    const id = paletteId ?? "spectra";
    root.dataset.artistPalette =
      iceColor || amberColor ? "custom" : id;
    const hues = resolveArtistHues(paletteId, overrides);
    setPaletteFromHues(hues, paletteId, {
      custom: !!(iceColor || amberColor),
    });
    return () => {
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
      delete root.dataset.artistPalette;
    };
  }, [paletteId, iceColor, amberColor]);

  return <>{children}</>;
}
