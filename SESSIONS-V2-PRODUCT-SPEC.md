# SESSIONS V2 — PRODUCT SPEC

**Status:** Specification. Nothing here has shipped.
**Companions:** `SESSIONS-V2-UX-DESIGN.md`, `SESSIONS-V2-TECHNICAL-DESIGN.md`,
`CALLS-PLATFORM-DESIGN.md`, `SESSIONS-V2-SECURITY-AND-PERMISSIONS.md`,
`SESSIONS-V2-IMPLEMENTATION-PLAN.md`.
`PRODUCT.md` describes only what exists today. Nothing in this file belongs there
until the matching work package ships.

---

## 1. The problem

Sessions today is a competent meeting tool wearing TEMPO's paint. It has an agenda,
shared notes, decisions, tasks, chat, and a video grid. None of that is about music.
Take the colours off and it is a general meeting app with a checklist attached.

Four things are missing, and they compound:

1. **A Session is not about anything.** You cannot point a room at the song it exists
   for. You can pin a track, but a pin is a bookmark, not a subject.
2. **You cannot listen together.** The one thing a music app should own — play the
   bounce, argue about the bridge at 1:42 — is impossible inside the room where the
   argument is happening.
3. **Starting a live call tells nobody.** It writes two database rows. Anyone not
   already staring at the page finds out later, if at all.
4. **The call is trapped in one page.** Navigating anywhere hangs up, so you cannot open
   the track you are talking about.

And one naming problem: the live part was called a "hang", which nobody outside the app
says, and which made the room and the meeting sound like different species.

## 2. Language (decided)

| Term | Means | Never say |
|---|---|---|
| **Session** | The room. A place that persists: people, agenda, notes, chat, history. | hang, meeting room |
| **instance** | One time you met in that Session. Sequential, never concurrent. | hang, session #2 as a separate room |
| **live** | An instance is running right now. Shown as the ON AIR plate. | in a hang |
| **the song** | The track a Session is about. | the pin |

Copy shifts: **Start session · LIVE · End session · 4th session · Past sessions**. A
Session card reads "4 sessions, last Aug 17". There is exactly one live instance per
Session at a time; the database already enforces this with a unique partial index.

## 3. What a Session becomes

> A room for one song (or one body of work), that you can walk into, that rings the
> people in it, that plays the music to everybody at once, that follows you around the
> app while you talk, and that writes down what you decided.

### 3.1 A Session is about a song

- Creating a Session offers a track from the active space. Optional, changeable later.
- The room header carries the song: artwork, title, current version, link to the track.
- Each instance records what was actually worked on, so History reads
  "Aug 17 · worked on v3" rather than "Aug 17".
- A Session with no song is still valid: standing writing rooms, label check-ins, a
  weekly that moves between songs. The song is a focus, not a requirement.

### 3.2 Listening together

- Anyone in the room can put a version on the deck. The default is the Session's song at
  its current version.
- Press play and **everyone hears the same bar at the same time**. Pause, seek, and
  version changes carry to everyone.
- Any listener can drop a marker at the playhead: "bridge is muddy" at 1:42. It becomes
  a timestamped comment on that version, visible on the track page afterwards, and it
  shows as a tick on the room's waveform while you listen.
- Guests on a link **never receive audio**. They see the markers and the title. This is a
  hard rule, not a setting.

### 3.3 The session rings

- Starting an instance notifies every other member: in-app bell, toast, and a line in the
  room chat that also lands in Messages.
- A guest sitting on the link sees the room go live within seconds, whether or not
  anyone has switched a camera on.
- Nobody is ever forced into a call. A notification is a doorbell, not a summons.

### 3.4 The call follows you

- One call at a time, app-wide. Once you are in, moving to Tracks, Board, or a track page
  keeps you connected.
- A dock appears wherever you are: who you are with, who is talking, mic, leave, and a way
  back to the room.
- This is also what makes calls outside Sessions possible — see `CALLS-PLATFORM-DESIGN.md`.
  Calling becomes an app capability available in every message thread: direct, group,
  artist team, and support.

### 3.5 The room writes its notes

- Opt in per instance with a "Take notes" toggle. Never on by default. Everyone in the
  room sees that it is on.
- Each person's own microphone is transcribed on their own machine and labelled with their
  name.
- Ending the session offers a recap: a summary, the decisions it heard, and tasks with
  owners.
- **Proposals only.** Nothing is written until a human accepts it, and every line is
  editable first. Rejecting is one click and leaves no trace.

## 4. Primary flows

### 4.1 Start a Session (room)
1. Sessions → New session → name, what it is for, space, people, **song** (optional).
2. Lands in the room, Standby, agenda empty, song shown in the header.

### 4.2 Run an instance
1. **Start session.** ON AIR plate lights, clock starts, everyone else is notified.
2. People join the call from the console, or watch and type without joining.
3. Someone puts the bounce on the deck and hits play; everyone hears it together.
4. Markers get dropped; agenda items get ticked; tasks and decisions accumulate.
5. **End session** → recap dialog (AI proposals if notes were on, otherwise a free-text
   summary) → accepted items become decisions and tasks; the instance closes into History.

### 4.3 Join as a guest
1. Open the link, enter a display name and the passcode.
2. See the room: ON AIR state, who is on the call, agenda, notes, pinned items, chat.
3. Join the call if the link allows mic and camera; otherwise listen and type.
4. Never see the catalog, never receive audio of a bounce, never see an artist id.

### 4.4 Call someone outside a Session
Covered in `CALLS-PLATFORM-DESIGN.md`: a call button in any thread, a ring on the other
end with Answer and Decline, a missed call left as a line in the thread.

## 5. Empty, loading, and failure states

| State | Behaviour |
|---|---|
| Session with no song | Header shows "No song yet · Choose one"; deck offers the space's catalog. |
| Standby, nobody on the call | Beacon at rest, "Start session" is the only strong action. |
| Live, nobody joined the call yet | "The room is open. Nobody is at the mic yet." |
| Deck with no playable version | "Nothing to play yet. Upload a bounce on the track." |
| Transcription unavailable | Toggle disabled with "Note taking is not available right now." Session runs normally. |
| Call fails to connect | Existing error line under the console, plus the relay fallback already built. |
| Guest link revoked mid-session | Guest drops to the "not available" screen; members see them leave. |

## 6. Non-goals

- **Concurrent instances / breakout rooms.** One live instance per Session, decided.
- **Recording the call.** Transcription of your own microphone is not a recording of the
  room, and nothing stores call audio.
- **Guest audio of unreleased music.** Not a permission, not a toggle. Never.
- **Renaming the database.** `session_meets` and friends keep their names; only the
  language people read changes.
- **Sync with external calendars or meeting tools.** A Session is not a calendar event.
- **Sessions as a general video conferencing product.** Everything earns its place by
  being about the song.

## 7. Success criteria

1. A member who is elsewhere in the app learns within seconds that a session started.
2. Two machines hear the same bar of the same bounce, and a marker dropped on one appears
   on the other and on the track page.
3. A call survives navigating from the Session to a track page and back.
4. After an hour-long session with notes on, the recap needs edits, not authorship.
5. Somebody looking at the Sessions list can tell what each room is about without
   opening it.
