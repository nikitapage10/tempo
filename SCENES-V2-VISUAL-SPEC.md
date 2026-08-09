# TEMPO Scenes V2 — Visual and Experience Specification

*Visual behavior is part of the feature contract. A screen is not complete
when its controls work; it is complete when hierarchy, composition, motion,
responsive behavior, loading, empty, error, focus, and reduced-motion states
have been verified.*

## 1. Visual thesis

A Scene should feel like entering a distinct venue while still knowing how to
return to TEMPO. The visual language is **network identity through stage
light**: the Scene's photography and palette shape its local atmosphere, while
TEMPO's black surfaces, typography, interaction color, depth, and flare-line
discipline keep the product coherent.

Do not imitate Mighty Networks' white three-column shell or exact navigation.
Borrow its clarity and completeness, then express the product through TEMPO's
dark Spectra system.

### Principles

1. **Identity before controls.** A Scene first reads as a place, then as software.
2. **One dominant surface per screen.** Avoid equal stacks of bordered cards.
3. **Atmosphere is contained.** Scene color lives in the Scene shell and hero,
   never recolors the global TEMPO rail.
4. **Dense areas stay calm.** Chat, member tables, and Studio forms use quiet
   surfaces; atmospheric effects frame rather than sit behind body text.
5. **Every image has a composition.** No unexplained center crops or floating avatars.

## 2. Shell layouts

### Nested Scene world — desktop (≥ 1200 px)

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ TEMPO rail   │ global search / notifications                              │
│              ├───────────────┬───────────────────────────────┬──────────────┤
│              │ Scene rail    │ primary Scene content         │ context rail │
│ Artist       │ identity      │                               │ optional     │
│ Workspace    │ Pulse         │ hero / section header         │ upcoming     │
│ core nav     │ Sections      │ feed/chat/library/etc.         │ people       │
│              │ People        │                               │ progress     │
│              │ About         │                               │              │
└──────────────┴───────────────┴───────────────────────────────┴──────────────┘
```

- TEMPO rail: existing width and behavior.
- Scene rail: 224–248 px, sticky below the global toolbar.
- Primary content: minmax(0, 820 px); feeds read best at 680–760 px.
- Context rail: 272–304 px; absent on focused chat/page views.
- Maximum nested canvas: use the existing 1440 px app maximum, allowing the
  Scene shell to consume the full available width rather than re-centering in
  a second narrow container.

### Tablet (768–1199 px)

- Scene rail collapses to a 56 px icon rail or an explicit drawer.
- Context modules move below the primary column in editorial order.
- The Scene identity remains visible in a sticky local header.

### Mobile (< 768 px)

- Sticky 52–56 px Scene header: emblem, name, Scene switcher, search, menu.
- Primary destinations use a horizontal bar beneath it.
- Full Section navigation, unread counts, groups, and Studio link live in a sheet.
- Content is one column with 16 px gutters and no horizontal page scroll.
- Chat composer respects safe-area insets and the TEMPO bottom navigation.

### Scene Studio

Studio uses a standalone shell: 232 px operating rail, full-width work canvas,
and no active artist/workspace controls. The top bar contains Scene switcher,
Preview, saved-state indicator, notifications, and Back to TEMPO. Structural
editing screens may use a 320 px inspector rail, but never add a third equal
card column by default.

### Standalone member Scene world

The standalone shell uses the same Scene hero, local navigation, content
renderers, palette scope, and responsive rules as the nested shell. It replaces
the TEMPO rail with a compact account rail/top bar containing the TEMPO mark,
Scene switcher, notifications, account menu, and optional Open TEMPO action.
The extra width is given to the Scene canvas; content measures do not become
unreadably wide. A member must recognize the same Scene in nested and
standalone contexts without seeing two competing designs.

## 3. Scene identity hero

This component replaces the current shallow cover strip and accidental emblem
overlap. It is shared by nested Pulse, public landing, and preview modes.

### Image composition

- Preserve the uploaded original; never make a destructive crop the source.
- Recommended source: 2400 × 800 (3:1), minimum 1440 × 600.
- Desktop rendered ratio: approximately 3.0:1 with
  `height: clamp(240px, 24vw, 360px)`.
- Tablet: 2.4:1, 220–300 px.
- Mobile: image region 16:9; identity moves into a dedicated strip below.
- Use `object-fit: cover` and stored `banner_focal_x/y` for `object-position`.
- When an image is unusually tall or narrow, show a clear crop warning in
  Appearance Studio rather than silently producing a bad result.

### Focal-point editor

Appearance Studio shows four synchronized previews: desktop hero, mobile hero,
browse card, and public page. The owner drags a focal target over the original
image. Save normalized 0–100 X/Y coordinates, not pixel values. Keyboard users
can nudge the target with arrow keys and reset it to center.

Upload helper copy states the recommended ratio before file selection. After
upload, editing the focal point is part of the same flow, not hidden in a later
advanced menu.

### Palette preservation over photography

An uploaded image does not replace Scene theming. The hero always layers:

1. Scene image or generated palette field
2. Low-opacity ice radial wash from upper-left
3. Low-opacity amber radial wash from lower-right
4. Dark bottom scrim sufficient for identity text
5. Very light deterministic grain
6. Scoped flare-line or luminous top edge

The **wash** treatment uses both palette colors at 8–16% perceived opacity.
**Cinematic** deepens the lower scrim and warms the image slightly. **Clean**
keeps only the minimum contrast scrim and edge light. No treatment removes the
Scene palette entirely.

### Identity placement

Desktop identity sits wholly **inside the lower hero composition**, never
halfway between hero and metadata:

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                        actions   │
│                                                                  │
│  [72px emblem]  SCENE NAME                                       │
│                 tagline                                          │
│                 type · members · location                        │
└──────────────────────────────────────────────────────────────────┘
```

- Emblem: 72 px desktop, 64 px tablet, 56 px mobile.
- Use a 1 px light edge plus soft black shadow, not a thick background-colored ring.
- Name/tagline/meta form one aligned block; member count never sits under a
  detached emblem by itself.
- Join/Manage/overflow actions occupy a separate action cluster at upper-right
  or lower-right, with a glass-dark well and one primary action.
- If the banner is visually busy, an adaptive local scrim sits behind identity
  content; never blur the entire photograph.

On mobile, the image ends first. A solid/gradient identity strip below contains
the emblem, name, tagline, metadata, then a full-width action row. The emblem
does not straddle the boundary.

### Contrast and accessibility

- Identity text must meet WCAG AA against the final layered composition.
- Banner alt text is owner-editable; decorative banners use empty alt text.
- Palette is never the sole indicator of membership, role, or action state.
- Reduced motion removes wash drift and parallax; the static composition remains.

## 4. Browse and discovery cards

The current card has a very short image and a large undifferentiated body. V2
cards use a clearer editorial composition:

- Image ratio 2.4–2.8:1 with the same focal coordinates and palette wash.
- Emblem lives in the content row below the image; no negative margin.
- Name and one-line proposition lead; Scene type becomes a small quiet chip.
- Footer contains members, next event/activity signal, and membership state.
- Unread uses a labeled signal or accessible dot beside the Scene name.
- Cards in `My Scenes` may show “Next” and unread; Discover cards show door and
  mutual/member context. Do not show the same footer in every context.
- Hover/focus uses SpotlightCard plus a subtle image scale (≤ 1.015). Reduced
  motion disables scale while keeping border/light feedback.

Grid widths: one column mobile, two tablet, three wide desktop. A card must not
grow beyond roughly 420 px merely because the row has one item.

## 5. Scene Pulse

Pulse should be the most visually expressive member surface after the hero.
Below the hero, use asymmetrical editorial hierarchy rather than a dashboard
of equal stat boxes.

### Desktop composition

- Main column: Now feature, recent discussions/resources, Continue
- Context rail: Next events, new members, onboarding
- A thin “signal path” (ice → white → amber) may connect Now/Next/New section
  labels, but it cannot sit behind dense copy.
- Member constellation is optional and data-driven. It uses existing profile
  imagery and deterministic placement, pauses offscreen, and becomes a simple
  avatar strip under reduced motion or on small screens.

### Content cards

- Announcements: restrained amber edge and explicit label
- Discussions: author-led, generous text measure, attachment secondary
- Events: date block, time/location, RSVP state, attendee faces
- Library: collection cover or media mark, item kind, duration/size
- New members: persona, short intro, meaningful connection action

## 6. Section-specific visual behavior

### Discussion

Use a 680–760 px reading column. Composer begins compact and expands in place.
Section filters live in the local rail or a single horizontal row, not a third
nested panel. Pinned items form one featured stack rather than duplicating the
chronological feed.

### Chat

Chat is a full-height work surface with message column and optional 280 px
people/details rail. Use quiet separators and grouped author runs; do not wrap
every message in a bubble. Own short messages may use a subtle tinted surface.
The composer is sticky within the Scene viewport, not the browser window.

### Events

Default to a strong upcoming list with a compact month navigator. Calendar
grid is a user-selectable view on desktop and an agenda on mobile. Event cards
use Scene palette in imagery/date accents while RSVP states retain global
semantic colors.

### Library

Collection covers create visual rhythm without pretending every file is album
art. Use a grid for collections and a readable row/list inside a collection.
Audio receives TEMPO waveform/play styling; videos/replays use a stable poster;
documents use type-specific marks.

### People

Offer List and Constellation views. List is the accessible default and includes
search, role/group filters, location, and short bio. Constellation is a visual
discovery layer, not the only way to find anyone.

### Pages and Showcase

Pages use a centered 720 px editorial measure with optional full-bleed image
blocks. Showcase uses 2–3 column cards and preserves the member's chosen media
ratio. No private track metadata appears unless frozen into the submitted item.

## 7. Scene Studio visual hierarchy

Studio is an operating surface, not a member feed wearing admin buttons.

- Overview: one dominant health summary, then attention queues and trends
- Structure: live navigation preview on left, ordered Sections center, inspector right
- Appearance: large live hero preview, then identity/crop/palette controls
- People: filterable table with inline role/group actions and explicit confirms
- Analytics: restrained charts using existing chart kit, with readable summaries
- Moderation: queue-first layout; evidence and action history remain visible

Saving uses an explicit top-bar state: Saved, Unsaved changes, Saving, or
Couldn't save. Structural operations are not toast-only.

## 8. Motion budget

| Motion | Standard | Reduced motion |
|---|---|---|
| Scene rail indicator | 160 ms position/opacity | instant |
| Hero palette wash | very slow contained drift | static |
| Card image hover | ≤ 1.015 scale, 180 ms | no scale |
| Drawer/sheet | short transform + opacity | opacity or instant |
| Member constellation | slow settle/float, pauses offscreen | static avatar strip |
| Reorder | direct drag with insertion light | keyboard move buttons |

No autoplay video, full-page parallax, continuous glowing text, or motion behind
chat/feed copy.

## 9. Loading, empty, error, and first-use states

- Skeletons match actual hero/rail/content regions.
- Empty Sections preserve their identity and offer one next action; they do not
  all reuse the same Spectra shader panel.
- First-use Pulse explains the Scene and shows setup progress without exposing
  Studio controls to members.
- Section failures remain local and provide Retry; the Scene shell stays usable.
- Missing migrations name the unavailable capability and required migration range.
- Image load failure falls back to the Scene palette composition without layout shift.

## 10. Visual QA matrix

Every major surface is reviewed at 1440, 1280, 1024, 768, 430, 390, and 320 px.
Required content cases:

- no banner / photographic banner / very bright banner / portrait-shaped banner
- no emblem / custom emblem / transparent emblem
- short and maximum-length names/taglines
- 1, 12, 100, and 10,000 members
- empty, normal, and very dense content
- owner, moderator, member, pending, invited, public visitor
- default, custom Scene palette, reduced motion, keyboard-only, and 200% zoom

The banner issue is accepted only when the uploaded Owl's Nest panorama retains
its owner-selected subject, the ice–amber Scene atmosphere remains visible,
the emblem belongs to a clear identity block, and the browse card/mobile/public
previews all look intentionally composed.
