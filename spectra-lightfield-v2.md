# SPECTRA v2 — THE LIGHTFIELD

*Reads on top of `spectra-pass-v1.md`. Sections 1–2 of v1 (tokens, FlareLine, buttons, cards, nav, inputs) still stand — they're the floor. This document replaces v1's shader-usage model (§2.6, the hero, the empty states) with something much more ambitious, and adds the signature systems that make TEMPO look like nothing else. v1's static gradients don't disappear: they become the fallback layer for reduced-motion and no-WebGL.*

---

## 0. The concept

Stop treating the shader as a decoration we place in boxes. Invert it:

> **The app is a solid black surface with one continuous field of prismatic light living behind it. The UI is a set of slits cut into that surface.**

One shader. One WebGL context. It renders full-viewport on a fixed canvas at the very back (`z-index: 0`), and the entire app chrome sits on top of it as opaque `--bg-0`. Anywhere we want light — the active nav indicator, a progress bar, a column header strip, the hero, an empty panel, the letterforms of the greeting — we simply *don't paint the black*. Every glowing element in the app is a window onto the same light source, so all of it drifts in perfect sync, because it literally is one surface.

This is cheaper than v1's plan (one context instead of one-per-screen, no instance bookkeeping) and categorically more interesting: the light feels like it lives *inside the machine*, not like a texture applied to components.

## 1. The Lightfield engine

### 1.1 Canvas
- `<Lightfield />` mounts once in the root layout: `position: fixed; inset: 0; z-index: 0; pointer-events: none;`. Everything else renders above it in a wrapper with `position: relative; z-index: 1; background: var(--bg-0);`.
- Internal render resolution capped at 1280×720 equivalent (the lines are soft; upscaling is invisible). DPR cap 1.5. Pause rAF on hidden tab. This keeps the always-on field cheaper than v1's per-screen instances.
- `prefers-reduced-motion` or no WebGL: the canvas is replaced by the `.flare-static` CSS gradient — every window below degrades automatically with zero component changes.

### 1.2 GLSL: parameterize, don't rewrite
The accumulation math is the identity — keep it. But promote its hardcoded constants to uniforms, each defaulting to the original value so default output is pixel-identical:

```glsl
uniform float uSpeed;     // default 0.06   (was: time*0.06)
uniform float uIntensity; // default 0.0008 (was: lineWidth)
uniform float uWarmth;    // default 0.0    (see below)
uniform float uSeed;      // default 0.0    (added inside random(): random(uv.x + uSeed))
```

`uWarmth` (−1…+1) biases the chromatic spread: it scales the per-channel time offset (`0.01*float(j)`) asymmetrically so negative values push the fringing toward the blue channel (ice) and positive toward red/amber. Implement as: `t - (0.01 + uWarmth*0.008)*float(j)` — small, surgical, reversible at 0.

These four uniforms are the entire API the app uses to *play* the light like an instrument.

### 1.3 The driver (this is the soul of the app)
A tiny module, `lib/lightfield.ts`, owns the uniforms and eases them toward targets (lerp over ~800ms — the light never snaps). App state drives it:

- **Tempo-sync — the name-defining feature.** When a track page is open (or a track is playing, once the player exists), `uSpeed` maps from its BPM: `uSpeed = 0.06 * (bpm / 120)`. **The light in the entire app drifts at the tempo of the track you're working on.** 174 BPM feels urgent; a 90 BPM tune feels syrupy. Nobody who notices this will ever forget it, and it costs one uniform.
- **Stage warmth.** On a track page, `uWarmth` maps from the track's stage position (Idea → −0.8 … Master/Released → +0.8). Early ideas bathe the app in cold light; a track at Master runs hot amber. The board sets warmth from the average stage of visible tracks; Today uses a neutral default.
- **Ambient activity.** `uIntensity` scales gently with this week's activity (sessions logged + versions uploaded, clamped ×0.7–×1.4). A dead week is dim and sparse; a productive week visibly hums. The dashboard becomes an ambient mood-light for your own output — no numbers needed to feel it.
- All mappings are clamped and eased; the field must never strobe or distract. If it's noticeable while reading body text, it's tuned too hot.

## 2. Windows (where the black is cut open)

Implement one utility, `.lf-window`: `background: transparent` (+ optional local scrim overlay). Because the canvas is globally behind everything, a window is just an un-painted region — no per-window cost, automatic sync. Standard windows:

1. **Nav active indicator** — the 2px strip beside the active item is a window. The active nav item is lit by the live field, not a gradient imitating it.
2. **Progress bars** — `FlareLine partial` upgrades: the track is `--border`; the filled portion is a window with a `brightness(1.3)` local boost. Checklist completion is *living light filling a channel*. At 100%, see §3.3.
3. **Board column strips** — each column's 2px header strip is a window with a per-stage tint overlay (stage hue at 35% via `mix-blend-mode: overlay`), so all five strips shimmer from the same field but read cold→hot left to right.
4. **The Today hero** — a ~140px window with the v1 scrim. Inside it, the signature type treatment (§3.1).
5. **Empty states** — `EmptyFlare` becomes a window + scrim + copy. No instance management needed anymore; every empty column on the board can glow simultaneously for free, so remove v1's live/static rule.
6. **Card hover edge** — on track-card hover, a 1px window outlines the card (masked border). Light literally leaks around the card you're about to pick up.

Discipline rule stays absolute: windows are thin strips, contained panels, or knockout type. Body text never sits directly on the field — copy always sits on ≥85% black.

## 3. Signature moments (the chances worth taking)

### 3.1 Knockout type — light through letterforms
The Today greeting ("Good evening") and the auth/login TEMPO wordmark render as **black panels with the text cut out**, so the lightfield shines through the letters themselves. Implementation: an SVG `<mask>` (rect + text) applied to an opaque `--bg-0` overlay sitting on the hero window — the letterforms are holes. Use the display face at 700, large (hero ≥ 56px), so the moving lines are legible inside strokes. This replaces any "gradient text" cliché — the type is genuinely *lit from behind*, and it animates in sync with everything else. Reduced-motion fallback: same knockout over `.flare-static` (still gorgeous, just still).

### 3.2 Light signatures — generative track artwork
Every track without artwork currently shows a broken-image box. Instead: **each track gets a unique, deterministic frame of the shader as its identity.** Hash the track ID to a float → pass as `uSeed` → render ONE frame of the shader at 512×512 on a throwaway offscreen canvas → `toDataURL` → cache in memory (and localStorage by track id) → use as the artwork everywhere (cards, lists, track header, Today). Tint the render toward the track's stage warmth. Result: no track is ever art-less, every track's placeholder is one-of-a-kind, siblings look like a family, and the artwork *warms up* if regenerated as the track advances. Cost: one 512px render per track, once. Real uploaded artwork always wins over the signature.

### 3.3 Reward sweeps
Three moments earn a flare: **checklist hits 100%**, **a new version uploads successfully**, **a session is logged**. The sweep: a 2px full-width window strip at the very top of the viewport opens, `uIntensity` spikes ×2 and eases back over 1.2s — a pulse of light travels through the app's top edge. One reusable `sweep()` call in the driver. Never triggered by navigation, only by *finishing something*. Skipped under reduced motion.

### 3.4 Drag spotlight
While dragging a board card, the hovered target column's background becomes a window at 6% scrim-opacity (barely-there light inside the column) and its header strip brightens. Drop → the strip does a fast local sweep. The board feels like moving a track through beams of stage light.

### 3.5 The player (when it ships)
The waveform is a window: waveform-shaped SVG mask over the field. Paused = the field drifts slowly inside the shape; playing = `uSpeed` locks to the track BPM. The playhead is a 1px `--flare-white` window with a glow. Build this to be the screenshot.

## 4. What this replaces from v1

- §2.6 `EmptyFlare` live/static rule → gone; all empty states are windows.
- v1 §4.1 hero → replaced by the knockout-type hero window.
- v1 §4.6 artwork placeholder → replaced by light signatures.
- Everything else in v1 (tokens, buttons, mono system voice, stage dots, deadline heat, motion timing, a11y floor) stands unchanged.

## 5. Tuning & guardrails

- Default field brightness sits LOW — the resting app should read as near-black with faint drifting color in its slits. The moments in §3 are only special because the baseline is quiet.
- One place to tune everything: the driver exposes `debugPanel` in dev (`?lf=debug`) with sliders for the four uniforms — tune by eye, then hard-code the mapping constants.
- Kill-switch: `NEXT_PUBLIC_LIGHTFIELD=off` env flag renders `.flare-static` everywhere. If perf on any real device is unacceptable, ship with it off and the app still looks like v1.
- FPS floor: if measured frame time exceeds 12ms for the field alone on a mid device, drop internal resolution before touching anything else.
- Version: this pass ships as v0.8.0 (do v1 first as v0.7.0 — see prompt).
