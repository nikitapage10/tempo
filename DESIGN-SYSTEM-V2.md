# TEMPO — Design System V2 (Track Workspace)

*Living document. Extends Spectra from `tempo-design-spec.md` §5 and `app/globals.css`. Does not replace the original tokens — it defines the redesigned track workspace and related patterns.*

**Related:** `SPECTRA-TITLE-LANGUAGE.md` — design-first mapping from track titles to vertical Spectra light slits (temporary cover art, reusable score).

**Implementation status:** Prompt 1 shipped (v0.7.0) — workspace shell, ambient header, stage timeline, sticky work panel. Prompt 2 workflow strip + attention signals also shipped in this pass (pending migration 001 confirmation). Comments (Prompt 3) not started.

---

## 0. v0.13 depth layer — what changed

Spectra shipped with flat fills, 1px outlines and no elevation. Every region
carried equal visual weight, which read as an "admin stack" (the problem §2
names for the track page — it applied app-wide). v0.13 extends the system
rather than replacing it. **Hues, fonts, the ice/amber split and the flare
motif are unchanged.**

Added tokens (`app/globals.css`):

| Token | Value | Role |
|-------|-------|------|
| `--bg-3` | `#1f1f27` | Highest surface (count chips, raised fills) |
| `--edge-hi` / `--edge-hi-strong` | `rgb(255 255 255 / .055` / `.09)` | Lit top edge on panels |
| `--shadow-1/2/3` | see file | Elevation ramp |
| `--radius-panel` | `16px` | Major surfaces only |

Added utilities: `.panel`, `.panel-quiet`, `.well`, `.lift`, `.glow-ice`,
`.glow-amber`, `.label-mono`, `.stat-value`, `.scrim-reveal`, `.scrim-center`.

As of v0.113, `.panel` and `.panel-quiet` are the app-wide glass surfaces:
they keep the existing radius, top edge, elevation, gradients and accent
layers, but use translucent fills and backdrop blur over the persistent
workspace video. `.well` remains the quieter nested surface and deliberately
does not add a second backdrop blur.

As of v0.118, peer modules share one cast shadow (`--shadow-2`) on `.panel`,
`.panel-quiet`, `.glass`, and `.glass-hero`. Quiet/primary hierarchy comes from
fill opacity and blur strength — not from stacking a deep drop next to a flat
tile. `--shadow-3` is reserved for true overlays (menus, dialogs, Origin
chapters). Soften the whole ramp so glass on the dark wash does not read as a
heavy black halo.

The amber→ice side stroke is **opt-in** via `.prism-edge` (with `.prism-edge-sm`
for tighter cards). Use it on page heroes and Board **columns** — not on every
track card or Calendar chrome. Board tracks keep the hover Spectra frame
(`LfWindow` + spotlight) instead of a permanent side line. The stroke is
vertically inset past the corner radius; do not put `overflow: hidden` on
`.prism-edge` itself (that breaks spotlight `fixed`/transform descendants).

Also added: `.spotlight` / `<SpotlightCard>` (`components/ui/spotlight-card.tsx`)
— a cursor-tracked highlight for clickable surfaces. Default tone is `ramp`,
which cross-fades ice → white → amber with pointer X (one shared listener via
`useSpotlightPointer`, not one per card). Edge glow tracks **local**
`--spot-x` / `--spot-y` on the card so Board stage transforms still show the
same hover rim as Tracks. Applied to every place a track,
project, or task appears as a clickable row/card — board cards, Tracks rows,
Today's attention list, project track lists, release track rows, project
cards, task rows. Don't invent a new hue for it; `tone` accepts the existing
palette tokens (`ice`/`amber`/`violet`/`ok`/`warn`) for state-driven cases
(e.g. `warn` when a track is blocked).

Also added: `<Wordmark>` (`components/wordmark.tsx`) — the TEMPO mark as live
markup (bars run the ice → white → amber ramp with a bloom, hairline
wide-tracked type), not a raster image. Used in the rail; reuse it anywhere
else the logo is needed instead of re-implementing.

Rules that changed:
- **Radius** — 10px card / 8px input / 999px chip still hold. `16px` is now
  allowed for *major* surfaces (page panels, hero, board columns).
- **Elevation** — shadows are now permitted and expected. Previously none.
- **Nesting** — do not put `.panel` inside `.panel`; the shadows compound.
  Use `.well` for rows/lists inside a panel.
- **Scrims** — body copy still needs ≥85% black over a lightfield window, but
  the scrim may be a *gradient* that clears where no copy sits
  (`.scrim-reveal` for left-aligned, `.scrim-center` for centred). This is how
  the shader became visible again without hurting contrast.

---

## 1. Preserved Spectra foundation

### Tokens
| Token | Value | Role |
|-------|-------|------|
| `--bg-0` | `#0A0A0C` | App chrome / deepest |
| `--bg-1` | `#121216` | Primary surfaces |
| `--bg-2` | `#1A1A21` | Elevated / selected |
| `--line` | `#26262E` | 1px borders / dividers |
| `--text-hi` | `#F2F0EB` | Primary text |
| `--text-lo` | `#8B8B96` | Secondary text |
| `--ice` | `#7FB4FF` | Interactive (buttons, links, focus) |
| `--amber` | `#FFB56B` | Status / current / emphasis |
| `--violet` | `#9D8CFF` | Rare accent |
| `--ok` | `#6FD99A` | Success |
| `--warn` | `#FF7A6B` | Danger / overdue |

### Typography (v0.117 — Jura UI, Inter numerals, lifted small sizes)
- **Jura** — geometric face for the product UI (rail, menus, titles, body).
  Hierarchy from weight: **300** wordmark, **500** body/controls, **600**
  titles, active nav, labels.
- **Inter** — numerals only (`.stat-value`, `.font-data`, `font-mono`, and
  `.tabular-nums`). Jura’s zero has a centre dot that reads oddly on counts;
  Inter keeps those clean.
- **Size** — body is 15px; Tailwind `text-sm` / `text-xs` sit one step up
  (15px / 13px); section labels are 12px. Dense meta that was 10–11px was
  lifted with the same pass.
- Custom artist logos remain images, not fonts.

### Rules
- Dark UI only.
- Ice = interaction; amber = status. Never both as competing CTAs.
- Radius: 10px cards, 8px inputs, 999px chips.
- `.flare-line` for active dividers / markers.
- The root Spectra shader stays in approved atmospheric moments (intro, empty states, active marks, selected feature areas), not as the dense-data backdrop. A separate softly focused video is the persistent signed-in workspace backdrop behind the shared glass surfaces; thin flare / slit dividers still punch through that video so the shader can run along page-header rules and rail ticks. The former top-edge shader strip is removed.
- `prefers-reduced-motion`: pause shaders; disable non-essential transitions; ambient tint may be static.

---

## 2. Design problems with the current track page

- Equal visual weight: every subsection is a bordered card → “admin stack.”
- Right column grows forever; primary listening surface does not dominate.
- Stage is a dropdown only — pipeline progress is hard to feel.
- No spatial hierarchy between identity, listening, and tools.

V2 keeps every current function but re-weights the layout.

---

## 3. Track workspace layout (target)

```
┌─────────────────────────────────────────────────────────────┐
│ TrackAmbientHeader (tint confined to this region)           │
│  back · artwork · title · mono meta · stage · momentum · due│
├─────────────────────────────────────────────────────────────┤
│ TrackStageTimeline  (horizontal stages)                     │
├──────────────────────────────┬──────────────────────────────┤
│ Primary column               │ TrackWorkPanel (sticky desktop)│
│  · VersionPlayer (dominant)  │  tabs: Work | Files | Notes |  │
│  · Versions (then timeline)  │        Details (+ later tabs)  │
│  · Now/Next/Blocked strip*   │                              │
│  · Session log               │                              │
│  · (later: comments under    │                              │
│     player or in panel)      │                              │
└──────────────────────────────┴──────────────────────────────┘
* Prompt 2
```

### Spatial principles
1. **Fewer nested bordered cards.** Prefer `--bg-0` / `--bg-1` surface shifts, section labels, spacing, and 1px `.flare-line` / `--line` dividers.
2. **One dominant listening surface** — player taller / more padding; secondary modules quieter.
3. **Tools in tabs** — preserve component state across tab switches (do not unmount if avoidable; use hidden/`display` or keep-alive pattern).
4. **No full-page artwork background.** Ambient tint only behind the header region.

---

## 4. Component hierarchy

| Component | Responsibility |
|-----------|----------------|
| `TrackWorkspaceShell` | Grid/regions, responsive breakpoints, panel query param |
| `TrackAmbientHeader` | Artwork, tint, title/meta/controls; wraps/refactors today’s header |
| `TrackStageTimeline` | Stages list, current marker, skip confirm, scroll-into-view |
| `TrackWorkPanel` | Tablist + tabpanels; `?panel=` sync |
| Existing panels | `VersionPlayer`, `VersionsPanel`, `SessionLog`, `TrackChecklist`, `AssetsPanel`, `TrackNotes`, `TrackDetails` — restyle containers, keep logic |
| Later | Workflow strip, comments, references, people, activity |

Page orchestrates data/selection only — not a giant presentational blob.

---

## 5. Track identity header + ambient tint

### Behavior
- Extract dominant color from artwork in the browser (canvas sampling) — **no new dependency**.
- If unavailable (no art, CORS, failure): deterministic HSL (or ice/amber mix) from hash of `track.id`.
- Apply as soft radial/linear wash **clipped to header** at low opacity (e.g. 8–16%) over `--bg-0`/`--bg-1`.
- Text remains `--text-hi` / `--text-lo` with contrast; if tint risks contrast, darken scrim.
- Reduced motion: static tint, no shimmer.

### Interaction states
| Control | Default | Hover | Focus | Disabled |
|---------|---------|-------|-------|----------|
| Back | text-lo | text-hi | ice ring | — |
| Title edit | text-hi | ice underline | ice ring | saving opacity |
| Momentum | chip | ice border | ice ring | — |
| Stage (if still in header) | — | prefer timeline as primary | | |
| Cover upload | dim overlay on hover/focus | | | busy |

---

## 6. Stage timeline

### Visual
- Compact horizontal track of stage pills/nodes connected by thin `--line`.
- **Prior stages:** completed-*looking* (muted ok or lower contrast) — **visual only**, not historical fact storage.
- **Current:** amber emphasis + `.flare-line` under or ice border — label clear.
- **Future:** text-lo outline.
- Recipe indicator (Prompt 6): small ice/amber dot with accessible name.

### Interaction
- Click/Activate → change stage via existing mutation.
- Skip >1 stage → confirm dialog (“Jump from Writing to Master?”).
- Adjacent or backward moves: no confirm (unless product later tightens).
- Keyboard: Left/Right or Tab between stages; Enter/Space activate.
- Narrow: `overflow-x-auto`; on load/change, `scrollIntoView` current stage.

### Failure
Stages error: inline warn text; timeline hidden or disabled; header/workspace still works.

---

## 7. Primary work area

### Player
- Dominant: more vertical space, less chrome around waveform.
- Transport: ice play; amber playhead/cursor (existing WaveSurfer colors OK).
- Version select accessible; mono time codes.

### Versions
- Immediately below player initially; later chronological timeline (Prompt 5) without losing upload/play/current/download/delete.
- Reduce double-card nesting: section label “Versions” + list on `--bg-1` once.

### Session log
- Main column; quieter type; composer studio-casual (“Log a session”).

### Workflow strip (Prompt 2)
- Below player or timeline; compact; 2×2 wrap on mobile.
- NOW / NEXT / BLOCKED / TARGET labels in mono or small caps; invitations when empty.

### Comments (Prompt 3)
- Prefer under player **or** Work panel tab — pick one in Prompt 3 and document. Markers on waveform use ice dots; resolved muted; selected amber.

---

## 8. Sticky work panel

### Tabs (v1)
| id | Label | Content |
|----|-------|---------|
| `work` | Work | Checklist (later workflow editor access) |
| `files` | Files | Assets + artwork |
| `notes` | Notes | Freeform notes |
| `details` | Details | Metadata + delete affordance |

Later tabs: Comments (or keep under player), References, People, Activity — only when shipped.

### Behavior
- Desktop (`lg+`): panel sticky within content viewport; does not cover left rail or bottom mobile nav.
- Mobile: segmented control horizontal scroll; panels in normal document flow below primary column (or stacked after primary — choose single column order: header → timeline → player → versions → strip → sessions → panel).
- Deep link: `?panel=files` etc.; unknown → `work`.
- Preserve state when switching tabs.
- Unresolved comment count badge on Comments tab when present (Prompt 3) — mono numeral; not color-alone.

### ARIA
- `role="tablist"` / `tab` / `tabpanel`
- `aria-selected`, `aria-controls`, `id` associations
- Arrow key navigation between tabs

---

## 9. Board & Today density (forward look)

- Cards: title, optional next-action line, 1 strongest signal; details affordance for more.
- Ice for links; amber for blocked/overdue emphasis marks **plus** text.
- Empty states: existing Spectra empty panels — do not invent new shader surfaces on Board cards.

---

## 10. Guest review page (Prompt 4)

- Focused branded page: wordmark restrained; track title hero of content (not marketing landing).
- Same tokens; no app rail.
- Waveform + comments only; no nested card explosion.
- Generic unavailable state — calm, no technical detail.

---

## 11. Focus mode (Prompt 7)

- Reduced shell: hide global nav distractions; clear Exit.
- Same tokens; larger timer in mono; goal in display/body.
- End session always visible on mobile.

---

## 12. Motion budget

| Motion | When | Reduced motion |
|--------|------|----------------|
| Tab indicator slide | panel change | instant |
| Timeline scroll-into-view | stage change | jump without smooth |
| Ambient tint fade-in | artwork load | instant static |
| Toast / dialog | system | opacity only or instant |

No continuous header animation. No full-page parallax.

---

## 13. Loading skeletons (Prompt 1)

Match regions:
1. Header block (~identity height)
2. Timeline bar
3. Player rectangle (taller)
4. Versions block
5. Panel tab bar + body

Avoid three equal mystery cards that ignore hierarchy.

---

## 14. Accessibility checklist (workspace)

- [ ] Focus visible (ice) on all controls
- [ ] Tabs and timeline fully keyboard operable
- [ ] Icon buttons have accessible names
- [ ] Status not by color alone
- [ ] 320px width: no horizontal page scroll (timeline may scroll internally)
- [ ] Contrast maintained over ambient tint
- [ ] Dialogs restore focus

---

## 15. Implementation notes for Prompt 1

- No new dependencies; no DB changes.
- Derive tint client-side; catch errors → id hash fallback.
- Refactor page into shell components; reuse existing queries.
- Update this file when Prompt 1 makes concrete layout choices (e.g. exact panel order on mobile).

### Concrete choices made (Prompt 1 + partial 2)

- Mobile single-column order: header → timeline → player → versions → workflow strip → session log → work panel tabs. Matches DOM order of `TrackWorkspaceShell`'s two grid children, which collapse to one column below `lg`.
- Stage dropdown is hidden by default in the header now that the timeline is primary (`TrackAmbientHeader` passes `showStageDropdown={false}` to `TrackHeader`); momentum and deadline stay in the header per spec.
- `TrackHeader` gained `bare` (skip its own outer card chrome) and `hideStage` props so `TrackAmbientHeader` can wrap it with the tint layer without duplicating title/cover/momentum/deadline logic.
- Ambient tint: a radial wash (`radial-gradient(120% 140% at 15% 0%, tint, transparent 62%)`) at 14% opacity, absolutely positioned behind the header content, faded in with `transition-opacity` (disabled via `motion-reduce:`). Falls back to `tintFromTrackId` when there's no artwork or extraction fails.
- Work panel tabs: Work (checklist), Files (assets), Notes, Details (metadata + Delete track, moved here from the page footer). Comments slot exists in the component API (`comments`/`commentsCount` props) but isn't wired until Prompt 3.
- `?panel=` omits the param entirely for the default `work` tab; unknown values fall back to `work`.
- Now/Next/Blocked/Target strip mapping: **Now** = `waiting_on` (“Your move” when empty), **Next** = `next_action` + `next_action_due`, **Blocked** = `blocked_reason`, **Target** = `deadline`. All four are inline-editable (click to edit, blur/Enter to save).
