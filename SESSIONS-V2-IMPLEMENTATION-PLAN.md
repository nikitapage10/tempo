# SESSIONS V2 — IMPLEMENTATION PLAN

**Status:** Execution plan. Read `SESSIONS-V2-PRODUCT-SPEC.md`,
`SESSIONS-V2-UX-DESIGN.md`, `SESSIONS-V2-TECHNICAL-DESIGN.md`,
`CALLS-PLATFORM-DESIGN.md`, and `SESSIONS-V2-SECURITY-AND-PERMISSIONS.md` before starting
a package. Do not start a package before the one it depends on has shipped.

Work packages are sized to be one push each. Every package must leave `main` shippable.

---

## Ground rules for every package

- Acquire a workspace first: `node scripts/agent-workspace.mjs acquire --wait --json`.
  Work only in the returned folder. Stage narrowly, never `git add -A`.
- A fresh workspace has no `node_modules`, no `.env.test.local`, and no
  `test/support/fixtures.json`. Run `npm ci` and copy the latter two from the main checkout
  or tests will fail for the wrong reason.
- Before pushing: `npx tsc --noEmit`, `npm test`, `npm run build`. Three pre-existing
  `test/unit/agent-workspaces.test.ts` type errors are expected; anything else is yours.
- Release pass once per push: `APP_VERSION` in `lib/version.ts` and `version` in
  `package.json` bumped and matching, a plain-English `CHANGELOG.md` entry, and `PRODUCT.md`
  updated when the feature set actually changed. Rebase on `origin/main` first, since other
  agents bump the same lines.
- Migrations are numbered files for the user to run by hand. Say so explicitly in the
  handoff when one is added.
- No em dashes in user-facing copy.

---

## WP0 — Room hygiene (no new concepts)

**Why:** two live bugs from the last pass, and the layout problem that makes the room feel
broken when people join.

Files: `components/sessions/session-stage.tsx`, `call-controls.tsx`,
`session-room-shell.tsx`, `session-chat-panel.tsx`, `app/join/[token]/guest-session-view.tsx`.

1. Remove the `action` prop from `SessionStage` and both call sites. The console is the
   only place to join.
2. Bottom-anchor the chat message list inside the Session chat panel only, so other
   Messages surfaces are untouched.
3. Viewport-lock the room: outer wrapper becomes a fixed-height flex column
   (`h-[calc(100dvh-<app header>)]`, `overflow-hidden`), with the stage column and chat rail
   each owning `min-h-0` + `overflow-y-auto`. Same on the guest page.
4. Console sticks to the bottom of the stage panel.

**Done when:** with four people on camera and two chat messages, the composer sits directly
under the last message, the page does not scroll, and there is exactly one join button.

---

## WP1 — Language: hang → session, instances

**Why:** the vocabulary has to be right before anything is built on top of it.

- Replace ~28 real `hang` references (word-boundary search; `change` is not a match) across
  `components/sessions/*`, `components/app-shell.tsx`,
  `components/onboarding/contextual-page-tour.tsx`, `lib/assistant/knowledge.ts`,
  `lib/demo/president.ts`, `lib/search/match.ts`.
- Rename client wrappers: `startSessionHang` → `startSessionInstance`, `endSessionHang` →
  `endSessionInstance` in `lib/api/sessions-rooms.ts` and `hooks/use-session-rooms.ts`.
  The RPCs keep their names. Update `SessionRoom` fields' *display*, not the field names.
- Copy: **Start session · LIVE · End session · 4th session · Past sessions**, card line
  "4 sessions, last Aug 17".
- `SessionHistory` becomes a real instance list: date, duration, who was there, recap.
- Update `PRODUCT.md` wording in the same push.

**Done when:** the word "hang" appears nowhere a person can read it, and History reads as a
list of past sessions.

---

## WP2 — A Session is about a song

**Migration:** `116_session_track_focus.sql` (see technical design §2.1). Tell the user to
run it.

- `create-session-dialog.tsx`: optional track picker, reusing `useTracks(spaceId)` the way
  `session-pins.tsx` already does.
- `session-rooms.ts` mapping + `SessionRoom` type gain `track_id`; `SessionMeet` gains
  `track_id` and `version_id`.
- Header shows artwork, title, current version, link to the track. No access to the track
  means "A song you do not have access to", never a blank.
- Starting an instance stamps `session_meets.track_id` and the current `version_id`.
- Guest state route returns the song title and a signed **artwork** URL only.
- Session cards on `/sessions` carry the artwork.

**Done when:** a new Session can be pointed at a song, History says what was worked on, and
a guest sees the title without any path to the audio.

---

## WP3 — The session rings

- New route `app/api/sessions/[id]/instance-notify/route.ts` (technical design §4.1).
- Client calls it only on the transition that actually opened an instance.
- Add the `session_live` case to `lib/notifications/href.ts` and an icon in the inbox UI.
- System line in the room chat: "Nikita started a session".
- Guest page: when polled `live` flips false → true, raise the amber prompt.
- Desktop: capability-detected bridge notification, silent fallback on older shells.

**Done when:** a member sitting on `/tracks` gets the bell, the toast, and a working deep
link within seconds, and a guest on the link sees it go live without touching anything.

---

## WP4 — Listen together

Depends on WP2.

1. `lib/calls/protocol.ts` with `encodePacket` / `decodePacket` and unit tests for unknown
   kinds and malformed payloads.
2. `hooks/use-session-call.ts` routes `transport`, `deck`, and `marker` packets out
   alongside the existing `chatTick`.
3. `components/sessions/session-deck.tsx`: own wavesurfer instance, signed URL via
   `lib/storage.ts`, registered with `lib/playback-coordinator.ts` as
   `session-deck:${roomId}`.
4. Sync per technical design §3.3: authority is whoever last pressed play, 5s heartbeat,
   0.35s drift threshold, packet **age** only, never absolute clocks. Unit-test the drift
   maths as a pure function.
5. Markers: `createComment({ trackId, versionId, text, timestampSec })` at the playhead,
   rendered as ticks and as a list beside the deck, broadcast so others refetch.
6. Run the RLS query in the security doc §3.2. Add `117_session_comment_access.sql` only
   if it returns non-zero.
7. Guests: transport moves their playhead, no audio source, no marker writes.

**Done when:** two machines hear the same bar, a marker dropped on one appears on the other
within a second and on the track page afterwards, and a guest sees the playhead move with
no way to hear or fetch the audio.

---

## WP5a — Lift the call out of the page

- `lib/calls/room-name.ts` (moved, re-exported from the old path for one release).
- `hooks/use-live-call.ts` = today's `useSessionCall`, scope-agnostic; keep
  `useSessionCall` as a thin wrapper for one release.
- `components/calls/call-provider.tsx` mounted beside `GlobalPlayerProvider` in
  `app/(app)/layout.tsx`.
- `components/calls/call-dock.tsx` in the app shell.
- Move `ScreenSourcePicker` and the hidden-tab disconnect into the provider; the disconnect
  keys off `document.hidden`, never route changes.

**Done when:** joining a call in a Session and navigating to a track page keeps you
connected and audible, with the dock visible and a way back.

---

## WP5b — Calls in message threads

Depends on WP5a.

- `app/api/calls/[scope]/[id]/livekit-token/route.ts` with per-scope membership checks;
  old session route forwards to it for one release.
- `app/api/calls/[scope]/[id]/ring/route.ts`, sharing the notify insert path with WP3.
- `components/calls/incoming-call.tsx` raised from `hooks/use-realtime-inbox.ts`: Answer,
  Decline, 45s timeout.
- Call buttons in `app/(app)/messages/messages-view.tsx` and `components/message-center.tsx`
  for direct, group, and artist team threads.
- System lines in the thread: started, ended with duration and who, missed.

**Done when:** a call started from a direct message rings the other person, connects,
survives navigation, and leaves a line in the thread when nobody answers.

**WP5c:** support threads, staff-initiated only.

---

## WP6 — The room writes its notes

**Migration:** `118_session_transcripts.sql`.

- "Take notes" toggle in the console, off by default, with a visible indicator for everyone
  including guests and a system line in chat.
- Per-client transcription of your own microphone via `useRealtimeDictation`, flushed on a
  4s / 400 character debounce, with a restart loop around `MAX_DICTATION_MS`.
- `app/api/sessions/[id]/recap/route.ts` + `lib/sessions/recap-schema.ts`, modelled exactly
  on `app/api/tasks/parse-task/route.ts` (allow-lists of real names, never invent).
- End session dialog becomes the recap dialog: editable proposals, accept per item, nothing
  written until accepted. Recap lands in `session_meets.summary`, never in
  `session_rooms.notes`.
- `assistant_usage.audio_seconds` ceiling; past it, note taking turns itself off with a
  plain message.

**Done when:** an hour-long session with notes on produces a recap that needs edits rather
than authorship, and declining writes nothing anywhere.

---

## WP7 — Make it a desk

Depends on WP4 (the deck is the spine).

- Split `SessionRoomShell` into `SessionHeader`, `SessionStage`, `SessionDeck`,
  `CallConsole`, `SessionRack`, `SessionChat`.
- Stage and deck become one continuous surface; console sits on the waveform.
- Header wash breathes with the loudest speaker's level, capped at 0.10–0.18 opacity.
- Roster becomes marks with status rings; the chip list moves to a tooltip.
- Rack empty states rewritten in studio-casual copy.
- Mobile: stage ≤40dvh, deck 72px, single tab bar, console above the rail.
- Full `prefers-reduced-motion` pass and the a11y checklist in the UX doc §6.

**Done when:** a screenshot of the room is recognisable as TEMPO and as a music room, at
1280px and at 390px, with reduced motion on and off.

---

## Suggested order and why

```
WP0 ──▶ WP1 ──▶ WP2 ──┬──▶ WP3
                      └──▶ WP4 ──▶ WP7
WP5a ──▶ WP5b ──▶ WP5c        WP6 (after WP4, independent of WP5)
```

WP0 and WP1 are cheap and make everything after them legible. WP2 unlocks both the ringing
copy ("Ferris Wheel is live") and the deck's default source. WP5a can be done in parallel by
someone else — it touches the call layer, not the room's contents. WP7 comes last because
the deck has to exist before the room can be built around it.

## Verification per package

Beyond `tsc` / `npm test` / `npm run build`:

| Package | Manual check |
|---|---|
| WP0 | Four tiles + two messages; composer position; one join button |
| WP1 | Grep for `\bhangs?\b` in anything user-visible returns nothing |
| WP2 | Migration run, create with a song, History shows the version |
| WP3 | Second machine on another page gets the bell; guest link goes live |
| WP4 | Two machines, same bar; marker round-trip; guest has no audio |
| WP5a | Join, navigate to `/tracks`, still audible, dock present |
| WP5b | DM call rings, answers, missed call leaves a line |
| WP6 | Notes on, talk for two minutes, recap proposals are accurate and decline writes nothing |
| WP7 | Screenshots at 1280 and 390, reduced motion on and off |

Call features need two real clients: the desktop shell and a browser guest link is the
cheapest pair that exercises both identity kinds.
