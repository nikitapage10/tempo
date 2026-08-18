# SESSIONS V2 — SECURITY AND PERMISSIONS

**Status:** Specification. Extends `SECURITY-AND-PERMISSIONS.md`; where the two disagree,
the older document wins and this one is wrong.

---

## 1. The boundaries that must not move

1. **A guest never receives audio of a bounce.** Not as a link setting, not for a "trusted"
   guest, not at a lower bitrate. The public state route already states this
   (`app/api/sessions/public/[token]/state/route.ts`): no `file_url`, no signed audio URL,
   no artist id. The deck does not change that.
2. **A guest never sees the catalog.** They see the Session's song title and artwork, the
   agenda, notes, pin titles, chat, and who is on the call. Nothing else.
3. **Membership is checked server side, per scope, every time.** Never from a room id or
   scope supplied in a request body without a matching membership query.
4. **The service role only runs in routes that have already checked the caller.** Same
   shape as `app/api/notify/route.ts`.
5. **Being in a Session grants access to that Session only.** It is not a back door into a
   track, a space, or an artist.

## 2. Role matrix

| Capability | Host | Member | Guest (link) | Non-member |
|---|---|---|---|---|
| Open the room | yes | yes | via link + passcode | no |
| Start / end an instance | yes | yes | no | no |
| Join the call | yes | yes | if link allows media | no |
| Put a version on the deck | yes | yes | no | no |
| Hear the deck | yes | yes | **no** | no |
| See deck markers | yes | yes | yes (text + time) | no |
| Drop a marker | yes | yes | no (v1) | no |
| Edit agenda / notes | yes | yes | no | no |
| Chat | yes | yes | if link allows chat | no |
| Create / revoke guest links | yes | no | no | no |
| Turn note taking on | yes | yes | no | no |
| Accept a recap into decisions and tasks | yes | yes | no | no |
| Read the transcript | yes | yes | no | no |

Guests dropping markers is a deliberate v1 non-goal: a marker writes a `comments` row
against a real version, and the guest path must never write to the catalog. Revisit only
with a separate guest-comment table.

## 3. RLS work

### 3.1 New columns (migration 116)
`session_rooms.track_id`, `session_meets.track_id`, `session_meets.version_id` are covered
by the existing `is_session_member` policies. **But** a member who cannot read the track
must not learn its title through the Session. Two rules:
- The client reads track rows under normal track policies. If the read returns nothing,
  the header shows "A song you do not have access to", not a blank.
- The public guest state route resolves the title and artwork **server side with the admin
  client**, exactly as it already does for pins, and returns only title plus a signed
  *artwork* URL. Artwork only. Never the audio path.

### 3.2 Comments (migration 117, conditional)
`own_comments` (`002`) is track-owner scoped; `101_team_permission_and_lifecycle.sql`
widens to artist team members. Before writing 117, run against the live database:

```sql
-- Any session member who is not on the artist's team?
select count(*) from session_members m
join session_rooms r on r.id = m.session_room_id
where m.status = 'active'
  and not exists (
    select 1 from artist_members am
    where am.artist_id = r.artist_id and am.user_id = m.user_id and am.status = 'active'
  );
```

Zero means skip 117 entirely. Non-zero means add **insert and select only**, scoped through
`session_pins` to the exact track or version the room is working on. Never grant update or
delete of somebody else's comment through a Session.

### 3.3 Transcripts (migration 118)
- `select`: active members of the instance's room.
- `insert`: `speaker_user_id = auth.uid()` and the caller is an active member of that room.
- `update` / `delete`: nobody through RLS. Purging is done by a security-definer function
  that checks host role.

## 4. Transcription privacy

Speech is the most sensitive thing this feature touches. Rules:

1. **Opt in per instance**, off by default, never remembered as "always on".
2. **Visible to everyone**: while notes are on, the console shows a recording-style
   indicator to every participant, including guests, and the chat gets a system line
   "Nikita turned note taking on".
3. **Your own microphone only.** Each client transcribes its own input. TEMPO never mixes
   or uploads the room's audio, and there is no call recording anywhere in this design.
4. **Guests are never transcribed** in v1, and the indicator tells them so: "Members are
   taking notes. Your microphone is not transcribed."
5. **Retention**: transcript lines live with the instance. A host can purge them from
   History; accepting a recap does not silently delete the source, and deleting the Session
   cascades them away.
6. **Never leaves the app**: transcript text goes to the model provider only inside the
   recap request, with `store: false`, exactly as the assistant already does.
7. **Safety identifier**: reuse the existing `OpenAI-Safety-Identifier: sha256(user.id)`
   header pattern so abuse tracking never carries a raw user id.

## 5. Cost controls

`assistant_usage` (migration `016`) currently guards only `/api/assistant`. The dictation
routes have **no quota at all**, and a room that listens for an hour is the first
unbounded-duration cost sink in the app.

- Add `assistant_usage.audio_seconds`, incremented as each client transcribes.
- Daily ceiling per user; past it, note taking turns itself off with a plain message and
  the session continues.
- The recap call itself counts against `messages` like any assistant call.
- Long transcripts are chunk-summarised before the final pass so one long session cannot
  send an unbounded prompt.

## 6. Calls in message threads

- Token minting checks `conversation_participants.left_at is null` at mint time. Leaving a
  group immediately prevents new tokens; existing ones die with their 2 hour TTL.
- The room name is derived server side from the conversation id. A client cannot ask for an
  arbitrary room.
- Direct threads: both parties are participants by construction, so no extra check.
- Support threads: the ring route additionally requires the caller to hold the support
  staff role. An artist pressing call in support is not offered the button at all.
- Blocked or removed people: if the app grows a block list, the ring route is the single
  place to enforce it.

## 7. Guest link hygiene (unchanged, restated)

- Passcode required, hashed; cookie is the bearer afterwards
  (`lib/sessions/public-request.ts`).
- `max_guests` enforced at token mint.
- Revoking a link drops guests at their next request and their next token refresh.
- Guest display names are attacker-controlled text: they are rendered as text, never as
  HTML, and they are truncated in the roster.

## 8. Threats considered

| Threat | Mitigation |
|---|---|
| Guest extracts an unreleased bounce | No audio path to guests at all; deck audio is a signed URL fetched only by members |
| Member of Session A joins Session B's call | Room name derived from the id the membership check ran against |
| Stale token after removal | 2 hour TTL, membership checked at mint, server-side eviction available |
| Transport packet spoofing | Packets only move a local playhead; they cannot grant access to audio a client could not already fetch |
| Marker spam | Comments are rate-limited by the existing comment path; markers carry the author |
| Transcript leak to a non-member | RLS select is scoped to active members of that instance's room |
| Runaway AI spend | Opt-in, per-user daily audio ceiling, chunked prompts, `store: false` |
| Ring spam / harassment | One ring per call plus one retry; missed calls leave a thread line; the ring route is the single choke point for a future block list |
