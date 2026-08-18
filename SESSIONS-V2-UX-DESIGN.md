# SESSIONS V2 — UX AND VISUAL DESIGN

**Status:** Specification.
**Read first:** `tempo-design-spec.md` §5 (identity) and `DESIGN-SYSTEM-V2.md` §0 (depth
layer). Everything here is an application of those, not an exception to them.

---

## 0. The idea

**The room has a spine, and the spine is the waveform of the song it is about.**

Today the room is three stacked grey panels: video, tabs, chat. Nothing tells you it is a
music room, and nothing tells you where to look. V2 puts one continuous surface down the
middle of the screen — faces on top, the waveform of what is playing underneath them,
markers as ticks on that waveform, and the console sitting on it. That strip is the thing
that makes a Session look like nowhere else in the app, and like nothing else in the
category.

Second principle: **the room is viewport-locked.** A room is a place you are in, not a
document you scroll. The header, stage, and console never leave; only the rack and chat
scroll, each in its own column. This is what fixes the composer drifting to the bottom
when people join.

## 1. Layout

### 1.1 Desktop (≥1280px)

```
┌──────────────────────────────────────────────────────────────┬──────────────┐
│ HEADER  ● ON AIR  12:04 · 4th session                        │              │
│   Wednesday Night Boredom          [Share] [End session]     │   CHAT       │
│   ▸ Ferris Wheel · v3        ◆◆◆ roster faces                │              │
├──────────────────────────────────────────────────────────────┤  messages    │
│                                                              │  bottom-     │
│   STAGE — video tiles, speaking edges                        │  anchored    │
│                                                              │              │
├──────────────────────────────────────────────────────────────┤              │
│   DECK — waveform of v3, markers as ticks, playhead          │              │
│   ◉ ▮▮ ▯ ⚙ ⏻   console sits on the waveform                  │              │
├──────────────────────────────────────────────────────────────┤              │
│ RACK  [Agenda 3] [Notes] [Tasks 1] [Pinned] [Decisions] [History]           │
│   ...scrolls independently...                                │  composer    │
└──────────────────────────────────────────────────────────────┴──────────────┘
```

- Grid: `lg:grid-cols-[minmax(0,1fr)_21rem]`, outer height
  `h-[calc(100dvh-var(--app-header-h))]`, `overflow-hidden`.
- Stage grows and shrinks with the tile count; the deck strip is a fixed 96px; the rack
  takes the remainder with `min-h-0` + its own `overflow-y-auto`.
- Chat column is a full-height flex column: label, `flex-1 min-h-0` scroller with messages
  **bottom-anchored** (`justify-end`), composer pinned beneath. It never stretches to match
  the stage.

### 1.2 Tablet (768–1279px)
Chat collapses into the rack as a peer tab. Stage and deck keep the top region.

### 1.3 Mobile (<768px)
Stage on top (max 40dvh), deck strip beneath it at 72px, then a single tab bar
(Agenda / Notes / Tasks / Pinned / Decisions / History / Chat). The console becomes a
fixed bottom bar above the tab bar, thumb-reachable. Per `tempo-design-spec.md` §6 the
rail is already a bottom tab bar here — the console sits above it, never under it.

## 2. Components

| Component | File | Notes |
|---|---|---|
| `SessionHeader` | `components/sessions/session-header.tsx` | On-air plate, clock, title, song, roster, actions |
| `SessionStage` | existing, revised | Tiles only; the join CTA moves out |
| `SessionDeck` | `components/sessions/session-deck.tsx` | Waveform, transport, markers, "now spinning" |
| `CallConsole` | `components/sessions/call-controls.tsx` | Round buttons; gains a deck-aware layout |
| `SessionRack` | `components/sessions/session-rack.tsx` | Tab strip + panel host |
| `SessionChat` | existing, revised | Bottom-anchored, own scroll |
| `CallDock` | `components/calls/call-dock.tsx` | App-wide, see `CALLS-PLATFORM-DESIGN.md` |
| `MarkerList` | `components/sessions/session-markers.tsx` | Timestamped notes beside the deck |
| `RecapDialog` | `components/sessions/session-recap-dialog.tsx` | End-of-session proposals |

### 2.1 Header

- **On-air plate**: amber, breathing dot, `ON AIR` in display caps with 0.22em tracking.
  Standby is the same plate in line grey. Already built; keep it.
- **Clock**: `font-data`, tabular, counting up from the instance start.
- **Instance count**: "4th session" beside the clock — the word doing the work the old
  "hang" did.
- **Song**: 40px artwork, title, current version chip, linking to the track. When the
  Session has no song: a quiet "Choose a song" button.
- **Roster**: overlapping marks (`SessionAvatarStack`) with status rings — amber for on the
  call, ice for in the room, nothing for away. The existing chip list moves to a tooltip
  on the stack, because eight chips is a wall of text.
- **Amber wash** behind the header breathes with the loudest speaker's level rather than a
  binary live flag. Cap the opacity swing at 0.10–0.18 so it reads as a room being alive,
  not a strobe.

### 2.2 Deck (new, the centrepiece)

- Full-width waveform in the artist's palette (`useActiveArtistPalette()`), 96px tall,
  seated directly under the stage with no gap and no border between them — they are one
  surface.
- **Idle state**: no version loaded. The strip shows the `.flare-line` motif at rest with
  the song title and a play affordance. Never an empty grey box.
- **Playhead** is a 1px white line with an amber cap. **Markers** are 2px amber ticks;
  hovering shows the note, clicking seeks everyone (see transport authority in the
  technical design).
- **Now spinning** label sits top-left of the strip: version number, who put it on.
- **Drop a note** button at the right of the console captures the current playhead.
- Guests see the same strip with the markers and no audio: the waveform renders from the
  marker positions only, no peaks, and no transport.

### 2.3 Console

Round 44px buttons on the waveform strip, not floating in a grey pill:
`mic (ringed by your own level) · camera · share · notes toggle · gear · leave`.
When you are not on the call it collapses to one **Join the call** button plus the gear.
**There is exactly one join affordance on the screen** — the duplicate currently rendered
inside the empty stage is removed.

### 2.4 Rack

Tabs with icons and counts (already built). Panel content gets real padding (16px), and
each panel owns an empty state written for a musician, not a form:
- Agenda: "Nothing to cover yet. Add what you want to get through."
- Decisions: "Nothing decided yet. Pin a message when you settle something."
- History: the instance list — date, duration, who was there, what was worked on, recap.

### 2.5 Chat

- Messages bottom-anchored; the newest sits just above the composer at all times.
- Compact bubbles: author line only when the speaker changes, 13px body, timestamps on
  hover.
- A system line style (centred, `text-lo`, no bubble) for "Nikita started the session" and
  "Dave joined the call".

## 3. Motion

- Everything obeys `prefers-reduced-motion`: the breathing wash freezes at its mid value,
  the beacon stops pinging, speaking rings become a static border colour.
- Tile enter/exit: 160ms opacity and 2% scale. Never layout-animate the grid.
- Deck seek: the playhead moves instantly; the waveform never animates position.
- The amber wash transition is 300ms so a room going live reads as a change of state.

## 4. Colour and hierarchy

- **Ice stays interactive** (join, primary buttons, links, focus rings).
- **Amber stays status** (on air, speaking, markers, live session cards). A session that is
  live is the only place in the app where amber outranks ice for attention, and it earns
  that because it is time-sensitive.
- Warn red is reserved for leaving the call and for a muted mic while you are speaking.
- Never put an ice CTA and an amber CTA side by side (design spec §5).

## 5. Copy rules

- No em dashes anywhere in user-facing text.
- Studio-casual: "Start session", "Put it on the deck", "Drop a note here", "End session".
- Never "hang", never "meeting", never "conference".
- The AI recap is always framed as a proposal: "Here is what I heard. Keep what is right."

## 6. Accessibility

- Every console button has an `aria-label` and a visible tooltip; state is carried by
  `aria-pressed`, never by colour alone.
- The deck is keyboard-operable: space toggles play, arrows seek 5s, `M` drops a marker.
- Speaking indication is a border **and** an icon, not just a glow.
- The waveform gets `role="slider"` with `aria-valuenow` in seconds and a text alternative
  ("2:14 of 3:48").
- Live regions: announce "Session started", "Dave joined the call" politely, once.

## 7. What we are deliberately not doing

- No skeuomorphic mixing desk. The console is round buttons on a waveform, not faders and
  wood grain.
- No per-user layout customisation. One room layout, tuned.
- No always-on video preview of yourself. The tile is enough.
