# Cursor prompt — Spectra v1 + Lightfield v2

*Use this INSTEAD of `SPECTRA-PROMPT.md`. First drop BOTH spec files into the repo root: `spectra-pass-v1.md` and `spectra-lightfield-v2.md`. Then paste everything below the line into Cursor as one prompt. Eight steps, each ending in a stop-and-test checkpoint; the first three ship as v0.7.0, the rest as v0.8.0, so you always have a good stopping point.*

---

Read `spectra-pass-v1.md` and then `spectra-lightfield-v2.md` in the repo root, both in full, before writing any code. v1 defines the token system and component styling; v2 defines the Lightfield architecture and supersedes v1 exactly where its §4 says so. Re-read `.cursorrules` — all its rules still apply.

Ground rules for the entire task:
- Visual pass only: no schema changes, no new features beyond what the specs describe, no route restructuring, no new dependencies (`three` is already installed).
- The shader's accumulation math is the visual identity — do not rewrite it. You MAY promote its hardcoded constants to the four uniforms in v2 §1.2 (`uSpeed`, `uIntensity`, `uWarmth`, `uSeed`), each defaulting to values that reproduce the current output exactly. Verify pixel-identical defaults before proceeding.
- Exactly ONE WebGL context in the whole app: the root `<Lightfield />` canvas (plus short-lived offscreen renders for light signatures, disposed immediately).
- Zero blue after the pass: no Tailwind `blue-*`/`sky-*`/`indigo-*`, no `#3B82F6`. Only the `--ice` token.
- After each numbered step: stop, summarize, wait for my test confirmation, then commit with the step name.

**Step 1 — Tokens (v1 §1 + §3).** CSS variables in `globals.css` mirrored in Tailwind config: surfaces, text, spectrum accents, `--flare-gradient`, glows, the `--stage-*` scale, and the `.flare-static` fallback gradient. Sweep the codebase replacing every hardcoded color with tokens — primary buttons go amber in this step.

**Step 2 — Components (v1 §2, minus 2.6).** `FlareLine` (`full` / `partial(pct)` / `tick`), the four button variants, card base + hover, sidebar active-nav strip (remove the gray pill), input focus rings, solid upload wells with drag-over glow. Apply the mono system voice (11px uppercase, 0.08em tracking, `--text-dim`) to every label, stat, date, and metadata string app-wide.

**Step 3 — Stage spectrum (v1 §3 + the §4 details that don't involve the shader).** Stage→hue mapping with interpolation for custom stages, hue dots on all track cards/rows, deadline heat colors, project completion lines, checklist checkbox styling. Then update changelog + product doc and bump to **v0.7.0** — this is a shippable checkpoint.

**Step 4 — Lightfield engine (v2 §1).** Refactor the shader component into the root-mounted `<Lightfield />`: fixed full-viewport canvas at z-0, capped internal resolution and DPR per spec, rAF paused on hidden tab; app content above it on opaque `--bg-0`. Add the four uniforms with identical-output defaults. Build `lib/lightfield.ts`: eased uniform targets (~800ms lerp), the three drivers (tempo-sync from BPM, stage warmth, weekly-activity intensity), a `sweep()` function, and the `?lf=debug` slider panel. Wire the `NEXT_PUBLIC_LIGHTFIELD=off` kill-switch and the reduced-motion/no-WebGL path that swaps the canvas for `.flare-static`. Keep the existing boot intro working on top of this (once per session, skipped under reduced motion).

**Step 5 — Windows (v2 §2).** The `.lf-window` utility, then convert: nav active strip, `FlareLine partial` fills, board column strips (with per-stage tint overlays), empty states (all of them — copy per v1's directive style), and the card hover edge. Body text must never sit on the raw field; verify every window against the ≥85%-black scrim rule.

**Step 6 — Knockout hero (v2 §3.1).** The Today hero window with SVG-mask knockout type for the greeting, stat line with flare ticks and amber numbers beneath it on solid black; same treatment for the wordmark on the login screen. Confirm the reduced-motion version renders the knockout over `.flare-static`.

**Step 7 — Light signatures + moments (v2 §3.2–3.4).** Deterministic per-track artwork: hash track id → `uSeed` → one 512×512 offscreen frame → dataURL, cached in memory + localStorage, tinted by stage warmth, used wherever artwork is missing (uploaded art always wins). Then the reward sweeps (checklist 100%, version upload success, session logged — nothing else) and the board drag spotlight with drop sweep.

**Step 8 — QA + ship.** Verify: exactly one WebGL context (inspect at runtime); grep confirms zero blue; kill-switch renders a fully-styled static app; reduced motion = no canvas, no sweeps, no intro, knockouts still render; keyboard focus visible everywhere; field frame time within budget on a mid device — drop internal resolution if not; contrast holds per v1 §6. Fix failures, update changelog + product description, bump to **v0.8.0**.
