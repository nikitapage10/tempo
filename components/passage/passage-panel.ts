/**
 * The glass every PASSAGE question sits on.
 *
 * Same material as the app's `.panel` (globals.css): rounded, hairline border,
 * a lit top edge, blur with a touch of saturation. The one deliberate
 * difference is the fill. `.panel` sits at 46% over the app's own dark
 * background, where that is plenty; Passage sits over the onboarding film,
 * whose vertical streaks blow out to near white. At that alpha the light
 * reads straight through the copy, which is what made headings and typed
 * answers hard to follow.
 *
 * The fill is written as an arbitrary `rgb(...)` rather than `bg-bg-0/96`
 * on purpose. Theme colours here go through `<alpha-value>` indirection, and
 * alpha modifiers on them have silently compiled to nothing in this codebase
 * before (see the --bg-*-rgb notes in globals.css). An arbitrary value cannot
 * fail that way, which matters for the one property carrying legibility.
 *
 * `cn` runs tailwind-merge, so this replaces OriginScrim's own background,
 * blur and shadow rather than fighting them.
 */
export const PASSAGE_PANEL = [
  "rounded-panel border border-line/70",
  "bg-[rgb(10_10_12/0.96)]",
  "shadow-[0_24px_80px_rgb(0_0_0/0.6)]",
  "backdrop-blur-[20px] backdrop-saturate-[1.1]",
].join(" ");

/**
 * The lit top edge from `.panel`, as an element the step can drop in. Kept
 * separate because the panels here also carry their own left-hand flare line.
 */
export const PASSAGE_PANEL_TOP_EDGE =
  "pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.16),transparent)]";
