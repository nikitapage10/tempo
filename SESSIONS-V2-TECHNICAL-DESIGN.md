# SESSIONS V2 — TECHNICAL DESIGN

**Status:** Specification.
**Companions:** `SESSIONS-V2-PRODUCT-SPEC.md`, `SESSIONS-V2-UX-DESIGN.md`,
`CALLS-PLATFORM-DESIGN.md`, `SESSIONS-V2-SECURITY-AND-PERMISSIONS.md`.

Everything below is additive. No table is dropped, renamed, or reset. The database keeps
`session_meets` and friends; only user-facing language changes.

---

## 1. What exists today (the ground truth to build on)

| Concern | Where |
|---|---|
| Room/meet/agenda/pins/tasks/decisions schema | `migrations/114_sessions_core.sql`, `115_sessions_guests.sql` |
| Client data access | `lib/api/sessions-rooms.ts`, `hooks/use-session-rooms.ts` |
| Call | `hooks/use-session-call.ts`, `lib/sessions/livekit.ts`, `livekit-room.ts`, `room-name.ts`, `presence.ts` |
| Call audio playback | `components/sessions/session-audio.tsx` |
| Device choice | `hooks/use-session-devices.ts`, `lib/sessions/av-devices.ts`, `components/sessions/av-settings-dialog.tsx` |
| Guest path | `app/join/[token]/*`, `app/api/sessions/public/[token]/*`, `lib/sessions/public-request.ts`, `link.ts` |
| Audio playback elsewhere | `components/track/version-player.tsx` (wavesurfer, `seekTo` only), `lib/playback-coordinator.ts`, `lib/storage.ts` |
| Timestamped comments | `migrations/002_timestamped_comments.sql`, `lib/api/comments.ts`, `hooks/use-comments.ts` |
| Notifications | `migrations/009_track_collaboration.sql` (+ later `entity_type` / `entity_id` / `link_url`), `hooks/use-realtime-inbox.ts`, `lib/notifications/href.ts` |
| Transcription | `hooks/use-realtime-dictation.ts`, `lib/dictation/*`, `app/api/assistant/realtime-transcription`, `live-dictation`, `transcribe` |
| Structured extraction pattern | `app/api/tasks/parse-task/route.ts` + `lib/tasks/task-schema.ts` |
| AI models and quota | `lib/ai/openai.ts`, `migrations/016_assistant_usage.sql` |

## 2. Data model changes

### 2.1 `116_session_track_focus.sql`

```sql
-- The song a Session is about.
alter table session_rooms
  add column if not exists track_id uuid references tracks(id) on delete set null;

-- What an instance actually worked on.
alter table session_meets
  add column if not exists track_id uuid references tracks(id) on delete set null,
  add column if not exists version_id uuid references versions(id) on delete set null;

create index if not exists idx_session_rooms_track on session_rooms (track_id);
create index if not exists idx_session_meets_track on session_meets (track_id);
```

`on delete set null` deliberately: deleting a track must never cascade a Session away.

RLS: `session_rooms` and `session_meets` policies already gate on `is_session_member`.
Adding columns does not change them. The **reader** of a track's title and artwork is the
client, under existing track policies, so a member without catalog access simply sees the
song as unavailable rather than being handed data.

### 2.2 `117_session_comment_access.sql` (conditional)

`own_comments` (`002`) is track-owner scoped; `101_team_permission_and_lifecycle.sql` widens
reads and writes to artist team members. **Verify against the live database before writing
this file.** It is only needed if a Session member can exist who is not an artist team
member. If so:

```sql
create policy session_member_comments_insert on comments for insert with check (
  exists (
    select 1
    from session_pins p
    join session_members m on m.session_room_id = p.session_room_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (p.track_id = comments.track_id or p.version_id = comments.version_id)
  )
);
```

Mirror for select. Never for delete or update of somebody else's comment.

### 2.3 `118_session_transcripts.sql`

```sql
create table if not exists session_transcript_lines (
  id uuid primary key default gen_random_uuid(),
  session_meet_id uuid not null references session_meets(id) on delete cascade,
  speaker_user_id uuid references auth.users(id) on delete set null,
  speaker_label text not null default '',
  body text not null,
  said_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_session_transcript_meet
  on session_transcript_lines (session_meet_id, said_at);

alter table session_transcript_lines enable row level security;
-- select: session members of the meet's room. insert: yourself only.

alter table assistant_usage
  add column if not exists audio_seconds integer not null default 0;
```

Retention: transcript lines are deleted when their instance is deleted, and a Session
setting can purge them after the recap is accepted. See the security doc.

## 3. Client architecture

### 3.1 Call layer generalisation (shared with `CALLS-PLATFORM-DESIGN.md`)

```
lib/calls/room-name.ts        callRoomName(scope, id) -> `tempo-${scope}-${id}`
                              memberIdentity / guestIdentity / parseParticipantIdentity (moved from lib/sessions/room-name.ts, re-exported there for one release)
lib/calls/protocol.ts         data-channel message types (below)
hooks/use-live-call.ts        the current useSessionCall, scope-agnostic
components/calls/call-provider.tsx   one Room for the whole app
components/calls/call-dock.tsx       persistent mini bar
```

`useSessionCall` stays as a thin wrapper for one release so nothing breaks mid-migration,
then goes away.

### 3.2 Data channel protocol (`lib/calls/protocol.ts`)

The room already broadcasts `{kind:"chat"}` over LiveKit data. Formalise it:

```ts
export type CallPacket =
  | { kind: "chat" }
  | { kind: "transport"; versionId: string; positionSec: number; playing: boolean; atMs: number }
  | { kind: "deck"; versionId: string | null; byIdentity: string }
  | { kind: "marker"; commentId: string; versionId: string; timestampSec: number };

export function encodePacket(packet: CallPacket): Uint8Array;
export function decodePacket(payload: Uint8Array): CallPacket | null;  // never throws
```

Rules:
- Everything is advisory. A client that receives an unknown `kind` ignores it, so an older
  desktop shell in the room degrades instead of breaking (web/desktop policy).
- `atMs` is the sender's `Date.now()`. Receivers do not trust clocks: they use it only to
  age the packet against their own receipt time (`ageMs = now - receivedAt`), never against
  the sender's absolute time.

### 3.3 Transport sync (the deck)

**Authority**: whoever last pressed play owns the deck. Their identity is broadcast in the
`deck` packet and shown in the UI ("Nikita is playing"). Anyone can take it by pressing
play; last write wins, and the UI says who has it. No host-only lock: a two-person writing
session should not need permissions.

**Publish** on play, pause, seek, version change, and every 5s while playing.

**Apply** on receipt:

```
expected = packet.positionSec + (packet.playing ? ageMs / 1000 : 0)
if (packet.versionId !== localVersionId) load that version, then seek to expected
if (Math.abs(local.currentTime - expected) > 0.35) local.seek(expected)
if (packet.playing !== local.playing) local.playing ? pause() : play()
```

0.35s is the drift threshold: tight enough that people are talking about the same bar,
loose enough to avoid a seek war on a slow network. Never seek in response to your own
packet (compare against `room.localParticipant.identity`).

**Late joiners** get the state from the next 5s heartbeat, so no join handshake is needed.

**Autoplay**: `room.startAudio()` already runs on join; the deck additionally requires the
local user to have interacted with the page. If a remote play arrives and playback is
refused, show the same amber "tap to hear" affordance the call audio uses.

### 3.4 The deck component

`components/sessions/session-deck.tsx`, its own wavesurfer instance. Do **not** retrofit
`components/track/version-player.tsx` — it is coupled to the track page (version list,
Spotify, comment prefill) and exposes only `seekTo`.

- Source URL: `getSignedUrl(version.file_url)` via `lib/storage.ts` (`peekSignedUrl` first
  for an instant start; the cache and desktop vault path come free).
- Register with `lib/playback-coordinator.ts` as `session-deck:${roomId}` so the global
  player pauses when the deck starts.
- Peaks: let wavesurfer compute them; do not add a peaks cache in v1. If load time on long
  bounces is bad, precompute peaks in a later package rather than blocking this one.
- Markers come from `useComments(trackId, versionId)` — already query-keyed and optimistic.
- Dropping a marker calls `createComment({ trackId, versionId, text, timestampSec })` and
  then broadcasts a `marker` packet so other clients refetch without waiting for a poll.

### 3.5 Room shell restructure

`SessionRoomShell` splits into `SessionHeader`, `SessionStage` (tiles only), `SessionDeck`,
`CallConsole`, `SessionRack`, `SessionChat`. The shell becomes layout plus wiring, and the
viewport lock lives there (see the UX doc §1).

## 4. Server routes

### 4.1 `app/api/sessions/[id]/instance-notify/route.ts` (new)

`POST { instanceId }`. Service role, modelled on `app/api/notify/route.ts` (which is
track-scoped and cannot be reused as-is).

1. `createServerClient()` → `auth.getUser()` → 401.
2. Confirm the caller is an active member of the Session (admin client, explicit query —
   do not trust the client's room id alone).
3. Confirm the instance is open and belongs to that room.
4. Insert one `notifications` row per other active member:
   `type: "session_live"`, `title: "<Session> is live"`, `body: "<Name> started a session"`,
   `entity_type: "session_room"`, `entity_id: roomId`, `link_url: /sessions/{roomId}`.
5. Never insert for the caller. Never for guests (they poll).

`hooks/use-realtime-inbox.ts` already listens for `notifications` INSERTs filtered by
`user_id`, so the bell, toast, and deep link work with no client change beyond an icon and
a copy case in `lib/notifications/href.ts`.

Rate limit: one notify per instance. Enforce by only sending on the transition that opens
the instance (the RPC already returns the existing id when one is open, so the client can
tell "created" from "rejoined" by comparing to the previous `open_meet_id`).

### 4.2 Session chat system line

Reuse the existing message path rather than inventing one: post into the Session's
conversation with a `system` flag so the chat can style it (centred, no bubble). If
`messages` has no system column, carry it as a sender-less message with a reserved body
prefix and render accordingly — decide when implementing, and prefer a real column if the
migration is trivial.

### 4.3 `app/api/sessions/[id]/recap/route.ts` (new, Phase 6)

`POST { instanceId }` → reads `session_transcript_lines` for that instance, calls
`ASSISTANT_MODEL` with a strict schema, returns proposals. Never writes.

```ts
// lib/sessions/recap-schema.ts
export type SessionRecap = {
  summary: string;                      // <= 600 chars, plain English
  decisions: string[];                  // <= 8
  tasks: { title: string; assigneeName: string | null; dueDate: string | null }[]; // <= 8
  agendaDone: string[];                 // agenda item bodies it heard being closed
};
```

Follow `app/api/tasks/parse-task/route.ts` exactly: `responses.create`, `store: false`,
`reasoning: { effort: "none" }`, strict JSON schema, and **pass allow-lists** of member
display names and agenda bodies with "return the name exactly as given, never invent one".
Cap the transcript sent (most recent ~12k tokens; summarise older chunks first if longer).

Quota: increment `assistant_usage.audio_seconds` from the client as it transcribes, and
reject the recap with a friendly message past a daily ceiling.

## 5. Transcription pipeline (Phase 6)

- Each client runs `useRealtimeDictation` on **its own microphone only**, started when the
  "Take notes" toggle is on and that person is on the call.
- `onTranscript` fires with the full accumulated text; diff against what was last flushed
  and append only the new tail.
- Flush on a 4s debounce or 400 characters, whichever comes first, inserting rows into
  `session_transcript_lines` with `speaker_label` = that person's display name.
- `MAX_DICTATION_MS` is 10 minutes in the existing hook; the session case needs a restart
  loop with a fresh session, keeping a small overlap to avoid dropping a word.
- If a client's transcription fails, the session continues and the recap covers whoever
  did work. Never block the call on note taking.

## 6. Performance and cost

- LiveKit connection minutes: the hidden-tab disconnect (`shouldDisconnectWhenHidden`,
  60s) already exists and must survive the move into the app-wide provider — a call in the
  dock is *not* hidden, so only disconnect when the whole document is hidden and the user
  is not on the call.
- Presence poll stays at 4s with a signature check (already implemented).
- Deck audio is a normal signed-URL fetch; it does not pass through LiveKit. Bandwidth is
  per-listener, which is fine and keeps quality at full fidelity.
- Transcription is the only unbounded cost. It is opt-in, quota'd, and visible to everyone
  in the room while it runs.

## 7. Failure modes to design for

| Failure | Behaviour |
|---|---|
| Two people press play within 200ms | Last packet wins; UI names who has the deck. No lock, no modal. |
| A client's clock is wrong | Irrelevant: only packet age is used, never absolute time. |
| Version deleted mid-session | Deck shows "That bounce is gone" and clears; markers stay on the track. |
| Guest connected when the deck plays | Guest receives transport packets but has no audio source; the playhead moves on their waveform so they can still say "at 1:42". |
| Older desktop shell in the room | Unknown packet kinds ignored; call and chat unaffected. |
| Notify route fails | Session still starts. Never block starting on a notification. |
| Recap model unavailable | End session falls back to the free-text summary field. |
