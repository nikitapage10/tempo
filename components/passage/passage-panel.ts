/**
 * The glass every PASSAGE question sits on.
 *
 * Origin's default scrim (bg-bg-0/40) was built against footage that is dark
 * where its copy lands. Passage holds its panels over the same film but at
 * different beats, and the bright vertical streaks read straight through that
 * alpha: headings and placeholder text were being cut in half by the light
 * behind them. This is the same material, just dense enough to actually carry
 * body copy over the brightest frames.
 *
 * `cn` runs tailwind-merge, so passing this after OriginScrim's own classes
 * replaces its background and blur rather than fighting them.
 */
export const PASSAGE_PANEL =
  "border-line/70 bg-bg-0/92 shadow-[0_24px_80px_rgb(0_0_0/0.55)] backdrop-blur-2xl";
