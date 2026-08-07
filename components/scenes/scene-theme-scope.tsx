"use client";

import * as React from "react";
import { artistThemeCssVars } from "@/lib/artist-theme";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/types";

/**
 * Applies a scene's own ice/amber pair on a WRAPPER element only — never on
 * document.documentElement. ArtistThemeProvider owns the root because Radix
 * dialogs portal to document.body and need to inherit it; a scene can't do
 * the same without recoloring the rail, the light field, and every open
 * dialog for everyone, which would make "ice = interactive" stop meaning one
 * thing app-wide. The active artist's ice stays the app's interaction color;
 * this only tints the scene's own header, cards, and charts.
 *
 * A dialog opened FROM a scene (e.g. an event editor) should apply this same
 * class at its own portal root if it wants the scene's tint — it does not
 * inherit it automatically, by design.
 */
export function SceneThemeScope({
  scene,
  className,
  children,
}: {
  scene: Pick<Scene, "palette_id" | "ice_color" | "amber_color">;
  className?: string;
  children: React.ReactNode;
}) {
  const vars = React.useMemo(
    () =>
      artistThemeCssVars(scene.palette_id, {
        ice: scene.ice_color,
        amber: scene.amber_color,
      }),
    [scene.palette_id, scene.ice_color, scene.amber_color]
  );

  return (
    <div
      className={cn(className)}
      style={vars as React.CSSProperties}
      data-scene-theme-scope=""
    >
      {children}
    </div>
  );
}
