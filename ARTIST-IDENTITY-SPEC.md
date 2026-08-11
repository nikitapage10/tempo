# TEMPO — Artist Identity Spec

*Feature spec for a self-contained build. Read `CLAUDE.md` and `.cursorrules`
first — this doc assumes and extends those rules, it does not replace them.*

> **Status: all phases implemented in v0.37.0** (2026-07-29). Phases 0–5 are
> built, type-check and production-build clean. Two deviations from this spec,
> both deliberate:
> - **Phase 2.5** — Settings renders `ArtistsManager` *above* a single
>   `SpacesManager` (option b), not one nested spaces list per artist
>   (option a). The spaces list is already artist-scoped and is now titled
>   "Spaces — {artist name}"; nesting would have required restructuring
>   `SpacesManager` away from the active-space context for little gain.
> - **Phase 4** — the placeholder cover's *atmospheric backdrop* keeps its
>   existing per-track colour variety; only the light slits take the artist's
>   palette. The backdrop is per-track distinguishability, not brand.
>
> Still outstanding: migration `021` must be run in Supabase, and the manual
> verification pass below has not been done (it needs a signed-in session).

## Why

Today one TEMPO account = one look, and `spaces` (Originals, Edits & Remixes,
etc.) belong directly to the user. This feature adds **Artist** as a new
entity above spaces: one account can manage multiple artist aliases, each
owning its own spaces, and each artist gets its own visual identity — logo,
banner (image or color), and an accent palette — so the tool feels like
*that artist's* tool.

**Hard constraint, stated by the product owner: no matter the visual
customization, it must still feel like TEMPO.** Concretely this means:
- Palettes are a **curated preset list**, not a free color picker — every
  preset keeps the same contrast against the fixed dark backgrounds and the
  same role semantics (see Non-negotiables below).
- Banners/logos are layered *within* existing chrome (panel radius, edge/shadow
  tokens, scrims) — never a full-bleed replacement of TEMPO's structure.
- The default state (no palette chosen, no banner/logo uploaded) is pixel-identical
  to today's TEMPO. Customization is additive and reversible.

## Non-negotiables (do not change without asking)

From `.cursorrules`, still true for every artist:
- Dark UI only. Fixed backgrounds: `--bg-0` `#0A0A0C`, `--bg-1` `#121216`,
  `--bg-2` `#1A1A21`, `--bg-3` `#1F1F27`, `--line` `#26262E`,
  `--text-hi` `#F2F0EB`, `--text-lo` `#8B8B96`.
- `--ok` `#6FD99A` (success) and `--warn` `#FF7A6B` (error/blocked) are
  **fixed for every artist** — they signal state, not brand, and must read
  identically everywhere so a user never has to relearn what a color means.
- Ice role = interactive (buttons, links, focus). Amber role = status/emphasis
  ("current" markers, momentum). Never both as CTAs together. **Per-artist
  palettes re-hue these two roles as a pair — they do not change what the
  roles mean.**
- Radii, `.flare-line` motif, `.panel`/`.well` elevation system, typography
  (Space Grotesk display / Inter everything else) are unchanged for every artist.
- The TEMPO wordmark (`components/wordmark.tsx`) is product identity, not
  artist identity — it is never replaced. Artist logo/name sits *alongside*
  it in chrome (switcher, settings), never instead of it.
- `prefers-reduced-motion` and the existing kill-switch/static fallbacks
  must keep working under every palette/banner.

## Out of scope (explicitly deferred — do not build)

- App icon, PWA manifest, `themeColor` (`app/icon.tsx`, `app/manifest.ts`,
  `app/layout.tsx`) stay global/static — one Next.js build serves every
  account, so these can't vary per artist without a dynamic manifest route,
  which is a separate, bigger change.
- The Spectra lightfield shader (`lib/shader-glsl.ts`) has no color uniform;
  real per-artist re-hueing of the lightfield itself (a `uPalette` uniform)
  is a stretch goal, not required for this build. A cheap optional touch —
  biasing each artist's resting `uWarmth` — may be added but is not required.
- Vocabulary customization (renaming track types, task categories, etc.) and
  assistant "about this artist" context were both explicitly considered and
  deferred by the product owner — not part of this build.

---

## Phase 0 — Already implemented (verify before building on top)

These files exist in the working tree as of this spec being written. **Read
them and confirm they match this description before continuing** — if this
build starts from a checkout that doesn't have them (e.g. a fresh clone that
never saw the uncommitted work), implement them exactly as specced here first.

- `migrations/021_artists.sql` — creates `artists` table (`id, user_id, name,
  logo_url, banner_url, banner_color, palette_id default 'spectra', sort,
  created_at`), RLS `own_artists`. Adds `spaces.artist_id` (nullable →
  backfilled one artist per existing user, named after their first space →
  set `not null` + indexed). **Additive only, must be run manually in
  Supabase — never auto-run.**
- `schema.sql` — updated to include `artists` table and `spaces.artist_id
  not null` as the new baseline, with `-- migration 021` comments matching
  the file's existing convention.
- `lib/types.ts` — adds `Artist`, `ArtistUpdate`, `ArtistPaletteId` types;
  `Space` gets `artist_id: string`.
- `lib/constants.ts` — adds `DEFAULT_ARTIST_NAME = "Artist Name"` and
  `ACTIVE_ARTIST_KEY = "tempo.activeArtistId"`.
- `lib/artist-theme.ts` (new file) — `ARTIST_PALETTES`: 6 curated presets
  (`spectra` default + 5 named pairs), each just an `{ice, amber}` hex pair.
  `artistThemeCssVars(paletteId)` → CSS var overrides for `--ice`, `--amber`,
  `--primary`, `--ring` (HSL derived via a local hex→HSL helper).
  `resolveArtistHues(paletteId)` → `{ice, white, amber, gray}` hex for JS/canvas
  consumers that can't read CSS vars (`white`/`gray` are fixed text tokens,
  not part of the artist role pair).
- `lib/storage.ts` — adds `buildArtistAssetPath({artistId, kind: "logo"|"banner",
  filename})` → `artists/{artist_id}/{kind}/{filename}`, same private `audio`
  bucket (storage RLS is `owner = auth.uid()`, not path-prefixed, so no
  policy change was needed — verify this is still true before assuming it).
- `lib/api/artists.ts` (new file) — `fetchArtists`, `createArtist`,
  `updateArtist`, `renameArtist`, `updateArtistPalette`,
  `countArtistContents(id)` (spaces + tracks count, for the destructive-delete
  confirm), `deleteArtist`, `reorderArtists`, `uploadArtistLogo`,
  `uploadArtistBanner` (clears `banner_color` when an image is set),
  `setArtistBannerColor` (clears `banner_url` when a color is set),
  `clearArtistLogo`, `ensureDefaultArtist`.
- `lib/api/spaces.ts` — `fetchSpaces(artistId?)` now filters by artist when
  given; `createSpace(name, sort, artistId, focus?)` takes an artist id;
  `ensureDefaultSpaces(artistId)` seeds defaults scoped to that artist.
- `components/active-artist-provider.tsx` (new file) — `ActiveArtistProvider`,
  `useActiveArtist()`, `useArtistMutations()`, and
  `useActiveArtistPalette()` (returns `ResolvedArtistHues` for the active
  artist — the hook JS/canvas consumers should call). Mirrors the existing
  `components/active-space-provider.tsx` pattern (localStorage-persisted
  active id, react-query bootstrap, optimistic reorder).

**Not yet done — this is where Phase 1 picks up:** `active-space-provider.tsx`
has NOT been modified yet (still creates spaces without an artist scope,
still calls the old zero-arg `ensureDefaultSpaces()` signature — this is now
a compile error against the updated `lib/api/spaces.ts` and must be fixed
first). Nothing is wired into the app layout. No UI exists yet.

---

## Phase 1 — Finish provider wiring (start here)

1. **`components/active-space-provider.tsx`** — make it artist-aware:
   - Import `useActiveArtist` from `@/components/active-artist-provider`.
   - `bootstrapUserDefaults` becomes `bootstrapSpacesForArtist(artistId: string)`:
     calls `ensureDefaultSpaces(artistId)` + `ensureDefaultTemplates()`.
   - The `spacesQuery` needs `queryKey: ["spaces", activeArtistId]` and
     `enabled: hydrated && !!activeArtistId && !artistLoading`, `queryFn: () =>
     bootstrapSpacesForArtist(activeArtistId!)`.
   - When `activeArtistId` changes, the current `activeSpaceId` is likely no
     longer valid (it belongs to the old artist) — the existing
     "re-resolve if not still valid" effect already handles this correctly
     as long as `spaces` in that effect is the artist-scoped list, so no
     extra logic needed beyond the query re-running.
   - `createSpace` calls from `useSpaceMutations` need an `artistId` param
     threaded through (the mutation's `mutationFn` signature gains
     `artistId: string`, sourced from `useActiveArtist()` at the call site
     in `components/spaces/spaces-manager.tsx`, not hardcoded inside the
     provider — a space can in principle be created for a non-active artist
     from a future UI, so keep it explicit).

2. **`app/(app)/layout.tsx`** — nest `ActiveArtistProvider` outside
   `ActiveSpaceProvider` (artist must resolve before spaces can bootstrap):
   ```tsx
   <ActiveArtistProvider>
     <ArtistThemeProvider>
       <ActiveSpaceProvider>
         <LightfieldDriver />
         <AppShell>{children}</AppShell>
       </ActiveSpaceProvider>
     </ArtistThemeProvider>
   </ActiveArtistProvider>
   ```

3. **`components/artist-theme-provider.tsx`** (new) — applies the active
   artist's palette as inline CSS custom properties on `document.documentElement`
   (NOT a wrapping `<div>` — Radix dialogs/dropdowns portal to `document.body`,
   outside any wrapping div, so they'd miss the override; `<html>` inline
   styles reach everything and win over the `:root` rule in `globals.css` by
   specificity):
   ```tsx
   "use client";
   import * as React from "react";
   import { useActiveArtist } from "@/components/active-artist-provider";
   import { artistThemeCssVars } from "@/lib/artist-theme";

   export function ArtistThemeProvider({ children }: { children: React.ReactNode }) {
     const { activeArtist } = useActiveArtist();
     React.useLayoutEffect(() => {
       const root = document.documentElement;
       const vars = artistThemeCssVars(activeArtist?.palette_id);
       Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
       return () => Object.keys(vars).forEach((k) => root.style.removeProperty(k));
     }, [activeArtist?.palette_id]);
     return <>{children}</>;
   }
   ```
   Because `spectra` (the default preset) is numerically identical to the
   hardcoded `globals.css` values, an artist who never changes their palette
   renders byte-identical output — verify this with a visual diff.

**Acceptance for Phase 1:** app builds and runs with no artist/space scoping
bugs. There's no user-facing artist switcher yet, but the sole existing
artist (from migration backfill) correctly scopes all spaces, and manually
changing `palette_id` for that artist row in Supabase visibly re-hues ice/amber
across the whole app (buttons, focus rings, flare-line) with no console errors.

---

## Phase 2 — Switcher UI + Settings artist manager

1. **`components/artist-switcher.tsx`** (new) — mirrors
   `components/space-switcher.tsx`'s dropdown pattern (button + listbox +
   "Manage" / "New" footer links to `/settings#artists`). Shows the artist's
   logo (via `SignedImage`, `components/ui/signed-image.tsx`) or, if none,
   a small tinted mark reusing `components/wordmark.tsx`'s bar-cluster motif
   at chip size, colored from `useActiveArtistPalette()`.

2. **`components/space-switcher.tsx`** — scope the space list to
   `activeArtistId` (spaces returned by `useActiveSpace()` are already
   artist-scoped after Phase 1, so this may need no change beyond
   confirming it — check before editing).

3. **`components/app-shell.tsx`** — render `<ArtistSwitcher />` above
   `<SpaceSwitcher />` in the rail (same `px-3 pb-4` block, ~line 108).

4. **`components/artists/artists-manager.tsx`** (new) — mirrors
   `components/spaces/spaces-manager.tsx` structure exactly (dnd-kit
   sortable list, inline rename, min-1 enforced): per artist row —
   - Name (inline edit, same pattern as space rows).
   - Palette picker: 6 swatches from `ARTIST_PALETTES`, click to
     `updatePalette.mutate({id, paletteId})`.
   - Logo: `SignedImage` preview + "Upload" (file input, image/* only,
     reuses the size/type validation pattern from
     `components/track/track-header.tsx`'s `handleCover`) calling
     `uploadArtistLogo`; "Remove" calling `clearArtistLogo`.
   - Banner: two modes, image or flat color — a small toggle. Image mode:
     same upload pattern as logo, calling `uploadArtistBanner`. Color mode:
     a constrained swatch row (reuse the same hue family as the palette
     presets, not a raw color picker — keeps banners visually consistent
     with the "curated, not freeform" rule) calling `setArtistBannerColor`.
     Live preview of the banner (small strip) inside the row.
   - Delete: **destructive, must confirm with real counts** — on click,
     call `countArtistContents(id)` and show "Deletes this artist, its N
     spaces, and M tracks inside. Sure?" (mirrors the exact wording pattern
     in `spaces-manager.tsx`'s `SortableSpaceRow` confirm block). Blocked
     client-side if `artists.length <= 1` ("Keep at least one artist"),
     same as the existing space min-1 rule.

5. **`components/spaces/spaces-manager.tsx`** — add an artist assignment:
   since Settings' space list is now implicitly scoped to *an* artist,
   either (a) render one `SpacesManager` per artist under its
   `ArtistsManager` row (nested — probably the better UX, keeps "this
   artist's spaces" visually grouped), or (b) keep a single global spaces
   list with an artist-select dropdown per row. **Prefer (a)** — it matches
   the "artist owns spaces" mental model better and avoids a cross-artist
   space list that undermines the whole point of the feature. `createSpace`
   calls in this component now pass the owning artist's id explicitly.

6. **`app/(app)/settings/page.tsx`** — render `<ArtistsManager />` (which
   internally renders spaces per artist) in place of the current
   `<SpacesManager />` top-level usage. Anchor `id="artists"` for the
   `/settings#artists` links used by the switcher.

**Acceptance for Phase 2:** create a second artist from Settings, give it a
different palette + an uploaded logo, switch to it via the rail switcher,
confirm its own independently-seeded default spaces appear, confirm the whole
app re-themes instantly with no reload, confirm deleting the non-active
artist shows accurate space/track counts and actually removes them (verify
against a throwaway artist with 1 test space/track, never against real data).

---

## Phase 3 — Banners (Today hero + artist card)

Scope, per product owner: banners apply to **the Today hero** (primary,
highest-visibility "this is X's TEMPO" moment) and **the artist's card in
Settings/switcher** (secondary, so you can see what you're picking). Do not
add banner surfaces beyond these two without checking in first — this keeps
the surface area bounded and reviewable.

**Today hero** (`app/(app)/page.tsx`) — currently the hero region has no
background treatment beyond the page's own dark surface (confirm current
structure before editing; the PRODUCT.md description says Prismatic light
already appears "behind the Today hero, where the cover over it fades out
toward the edges so the motion is actually visible — never as a full-page
background behind dense data" — the banner must respect this same rule):
- If the active artist has `banner_url` or `banner_color` set, render it as
  a background layer within the hero panel (same rounded-panel radius as
  today, same outer edge/shadow tokens — do not introduce a new panel style).
- **Image banners get a scrim**: a dark gradient overlay (reuse the existing
  `.scrim-reveal` utility class from `globals.css` if its shape fits, or a
  `linear-gradient` fading to `--bg-0` at the edges/bottom) so hero text
  (greeting, counts) stays legible at the same contrast ratio as today, and
  so the effect reads as "TEMPO's hero, tinted with the artist's image" not
  "a photo with text on it."
  - `SignedImage` (not `<img>` directly) resolves the storage path.
- **Color banners** render as a subtle gradient wash from the artist's chosen
  color toward `--bg-0`, not a flat fill — matches the existing "surfaces are
  layered and lit, not flat" design language from `PRODUCT.md`.
- **No banner set (default)**: hero renders exactly as it does today — zero
  visual change. This is the majority case and must regress to nothing.
- Respect `prefers-reduced-motion` (no new motion is being added here, but
  confirm the lightfield's existing fade/pause behavior near the hero is
  undisturbed by the new layer's z-index/opacity).

**Artist card** (Settings `artists-manager.tsx` + the switcher dropdown's
open panel) — smaller-scale version of the same treatment: a short banner
strip at the top of each artist row/card, same scrim rule for images.

**Acceptance for Phase 3:** set an image banner on one artist, a color banner
on another, leave a third with none. Confirm Today's hero looks correct and
legible for all three, confirm the "none" case is pixel-identical to current
production, confirm the same banner also shows correctly (scaled down) in
Settings.

---

## Phase 4 — Re-hue JS/canvas consumers

CSS-var consumers (buttons, focus rings, `.flare-line`, `.panel` accents,
shadcn `--primary`/`--ring`) are already handled by `ArtistThemeProvider`
from Phase 1 — nothing to do there. These files bypass CSS vars with literal
hex and must be threaded to `useActiveArtistPalette()` (or an equivalent
resolved-hex prop) instead:

- **`lib/spectra-title-language.ts`** — `SPECTRA_HUE_HEX` (currently
  hardcoded `ice`/`white`/`amber`/`gray`). Change the functions that consume
  it (`titleToSpectraScore` etc.) to accept an optional palette override, or
  refactor so the hue *name* stays fixed but hex resolution happens at the
  render site in `spectra-cover-art.tsx` instead — check which is less
  invasive before choosing.
- **`components/spectra/spectra-cover-art.tsx`** (line ~176, hardcoded
  `const base = "#0a0a0c"` plus wherever it maps `SpectraHue` → hex) — accept
  a `palette` prop (default = current hardcoded values) and call
  `useActiveArtistPalette()` at call sites within the authenticated app
  (Today's cover strip, Tracks list, Board cards, track header). This is
  what makes an artist's whole catalog of un-arted covers read as one
  consistent set — the main visible payoff of this phase.
- **`lib/stage-hue.ts`** — `ICE`/`WHITE`/`AMBER` constants feed
  `stageHueAt()`, used for the board's stage-progress ramp. Same treatment:
  accept a palette or read it via a hook at the call site (`components/board/`
  — find current callers first).
- **`components/track/version-player.tsx`** (lines ~106-124, 244) —
  wavesurfer `waveColor`/`progressColor`/`cursorColor` and a canvas gradient,
  currently hardcoded hex. Resolve via `useActiveArtistPalette()` in this
  component.

**Acceptance for Phase 4:** switch an artist to a non-default palette,
confirm placeholder covers, the board's stage-color ramp, and the waveform
player all re-hue consistently with the buttons/UI chrome (all reading as
one coherent palette, not a mix of old and new hues).

---

## Phase 5 — Guest review page palette

Guest review links (`app/review/[token]/`) are public, unauthenticated pages
— they have no access to `useActiveArtistPalette()`. Resolve server-side:

- **`app/api/review/[token]/route.ts`** — the query already joins
  token → version → track. Extend it to also join track → space →
  `artist_id` → `artists.palette_id`, resolve via `resolveArtistHues()`
  (from `lib/artist-theme.ts`, safe to import server-side — it's pure data),
  and include the resolved hex in the JSON response.
- **`app/review/[token]/guest-review-view.tsx`** (lines ~195-197) — use the
  hex from the API response for wavesurfer's `waveColor`/`progressColor`/
  `cursorColor` instead of the hardcoded values.

**Acceptance:** a guest link for a track under a non-default-palette artist
shows that artist's colors on the waveform; a guest link under the default
artist looks unchanged.

---

## Release checklist (required — see `CLAUDE.md`)

Before this is pushed (not per-phase, once at the end):
1. Bump `APP_VERSION` in `lib/version.ts` and `version` in `package.json`
   (currently `0.35.2` — this is a new feature, so minor bump, e.g. `0.36.0`;
   both must match).
2. `CHANGELOG.md` — plain-English entry under today's date, written for a
   musician: e.g. "Added: you can now manage more than one artist name in
   TEMPO, each with its own spaces, colors, logo, and banner." Include an
   "Under the hood" line telling the user to run `migrations/021_artists.sql`
   in the Supabase SQL editor before this deploys, since existing spaces
   depend on it.
3. `PRODUCT.md` — fold this into the "Spaces" section (or split into its own
   "Artists" section above it) in flowing prose, no file paths/component
   names, describing what exists **after** this ships.
4. Confirm `migrations/021_artists.sql` has been run against the target
   database before this deploys — the app will hard-fail on `spaces` queries
   otherwise (`artist_id` is `not null`).

## Verification (manual, no automated test suite exists for this yet)

Run through in order, on a real (or disposable test) account:
1. Fresh account sign-up still lands correctly with one default artist and
   its two default spaces (Originals, Edits & Remixes) — confirm bootstrap
   order doesn't race or duplicate-create.
2. Create a second artist, verify it gets its own default spaces, verify
   switching artists never leaks tracks/tasks/projects across artists.
3. Set each of the 6 palettes on the active artist one at a time, confirm
   ice/amber-derived UI (buttons, focus ring, flare-line, board stage ramp,
   placeholder covers, waveform) all shift together and `--ok`/`--warn`
   never change.
4. Upload a logo, upload an image banner, then switch to a flat color
   banner (confirm the image is cleared/deleted), confirm Today's hero and
   the Settings card both reflect it.
5. Guest review link under a non-default artist shows that artist's palette.
6. Delete a throwaway artist (never a real one) and confirm the
   confirmation dialog's counts were accurate and nothing else was affected.
7. `prefers-reduced-motion` on: confirm no regressions in the hero/banner
   area.
8. No console errors, `npm run lint` clean.
