# CALLS AS A PLATFORM CAPABILITY

**Status:** Specification.
**Why this is its own document:** calling started inside Sessions, but it is not a Sessions
feature. It belongs to the app: any message thread should be callable, and one call should
survive moving around the app. Sessions then becomes the richest *surface* for a call
rather than the only place one can exist.

---

## 1. Scope

| Surface | Audio call | Video call | Screen share | Guests |
|---|---|---|---|---|
| Session room | yes | yes | yes | yes, via passcode link |
| Direct message | yes | yes | yes | no |
| Group message | yes | yes | yes | no |
| Artist team thread | yes | yes | yes | no |
| TEMPO Support thread | staff-initiated only | staff-initiated only | yes | no |
| Scene / social feed | no | no | no | no |

**One call at a time, app-wide.** Starting a second call asks you to leave the first. This
is a deliberate constraint: it keeps the dock unambiguous and the audio graph simple.

Support is asymmetric on purpose — an artist ringing an unstaffed desk would be a worse
experience than no button at all. Flip it later by removing the role check if support
becomes staffed for live calls.

## 2. Architecture

### 2.1 Room naming and identity

`lib/sessions/room-name.ts` becomes `lib/calls/room-name.ts` (re-exported from the old path
for one release so nothing breaks mid-migration):

```ts
export type CallScope = "session" | "conversation";
export function callRoomName(scope: CallScope, id: string): string;  // `tempo-${scope}-${id}`
export function memberIdentity(userId: string): string;              // `u:${userId}`  (unchanged)
export function guestIdentity(guestId: string): string;              // `g:${guestId}` (unchanged)
export function parseParticipantIdentity(identity: string): ...      // unchanged
```

Keeping the identity scheme means presence (`lib/sessions/presence.ts`), the roster, and
guest labelling all work unchanged on the new scopes.

### 2.2 Token route

New `app/api/calls/[scope]/[id]/livekit-token/route.ts`, replacing
`app/api/sessions/[id]/livekit-token/route.ts` (which stays as a thin forwarder for one
release).

```
POST /api/calls/session/{roomId}/livekit-token
POST /api/calls/conversation/{conversationId}/livekit-token
```

1. `auth.getUser()` → 401.
2. Membership check by scope, server side, never from the request body:
   - `session`: active row in `session_members`.
   - `conversation`: row in `conversation_participants` with `left_at is null`
     (`migrations/031_messaging.sql:32`).
3. Mint with `mintSessionLiveKitToken` (rename to `mintCallToken`): `roomJoin`, `room`,
   `canPublish`, `canSubscribe`, `canPublishData`, **`canUpdateOwnMetadata`** — the last
   one is what the `oncall` attribute needs, and forgetting it was a real bug once.
4. TTL: 2 hours, as today.

The guest token route stays session-only: `app/api/sessions/public/[token]/livekit-token`.
Conversations never issue guest tokens.

### 2.3 Provider and dock

Mirror `components/player/global-player-provider.tsx`, mounted beside it in
`app/(app)/layout.tsx`:

```ts
// components/calls/call-provider.tsx
type CallTarget = { scope: CallScope; id: string; title: string; href: string };

type CallContextValue = {
  room: Room;
  target: CallTarget | null;
  connected: boolean;
  onCall: boolean;
  roster: SessionPresenceParticipant[];
  start(target: CallTarget): Promise<void>;   // connect + oncall
  join(): Promise<void>;                      // already connected, step to the mic
  leave(): Promise<void>;
  // mic/camera/screen/device passthrough as today
};
```

- The Session room page calls `start({scope:"session", ...})` when you press Join, and
  otherwise **connects without joining** so presence works while you lurk. Conversations
  connect only when a call actually starts, so a quiet thread costs nothing.
- `components/calls/call-dock.tsx` renders when `target` is set and the current pathname is
  not that target's page: title, speaking indicator, mic toggle, leave, "Back to it".
  Same visual family as `global-player-bar.tsx`, sitting above it when both are present.
- The hidden-tab disconnect (`lib/sessions/livekit-room.ts`) moves into the provider and
  keys off `document.hidden`, not route changes.
- Register the call with `lib/playback-coordinator.ts` so starting a track pauses nothing
  during a call and vice versa: the coordinator gets a `call` participant that refuses to
  be auto-paused but does pause the global player when a call starts.

## 3. Ringing

### 3.1 Outbound

`POST /api/calls/[scope]/[id]/ring` → notifications for every other participant:

```
type:        "call_incoming"
title:       "<Caller> is calling"
body:        <thread or session title>
entity_type: "conversation" | "session_room"
entity_id:   <id>
link_url:    /messages?c=<id>  |  /sessions/<id>
```

Re-uses the same insert path as `instance-notify` (Sessions Phase 3); one route, two
scopes. A ring is valid for 45 seconds; the caller's client re-rings once, then stops.

### 3.2 Inbound

`components/calls/incoming-call.tsx`, raised from `hooks/use-realtime-inbox.ts`, which
already subscribes to `notifications` INSERTs:

- A glass card, top-right on desktop, full-width sheet on mobile: caller mark, thread name,
  **Answer** (ice) and **Decline** (quiet). Answering navigates to the thread and joins.
- Ringtone: short, quiet, respects the OS reduced-audio and the app's existing sound
  settings if any; never plays if the user is already on a call.
- Auto-dismiss after 45 seconds and post a missed-call line into the thread.
- If the same user is signed in on desktop and web, both ring; answering on one dismisses
  the other via a `call_answered` notification, best effort.

### 3.3 In-thread record

Every call leaves a line in the conversation, so calling is not invisible history:

- "Nikita started a call" when it starts.
- "Call ended · 12 min · Nikita, Dave" when the last person leaves.
- "Missed call from Nikita" on a 45s timeout with nobody answering.

These are system messages (see the technical design §4.2 for the system-line decision) and
they carry the unread count like any other message, which is what makes a missed call
discoverable later.

## 4. UI entry points

| Where | What |
|---|---|
| `app/(app)/messages/messages-view.tsx` header (~line 143) | Phone and video buttons, right of the thread title, left of Search |
| `components/message-center.tsx` | Call button on the active thread in the mini-inbox |
| Session room console | Join the call (existing) |
| Call dock | Mic, leave, back |
| Incoming card | Answer, Decline |

Buttons are hidden, not disabled, where calling does not apply (Scenes, support for
non-staff), so the UI never dangles an affordance that cannot work.

## 5. Desktop

Per `docs/WEB-DESKTOP-RELEASE-POLICY.md`:

- All of this is shared web code; nothing new goes in `electron/`.
- The existing screen-source picker (`components/sessions/screen-source-picker.tsx`) is
  already capability-detected and works for any call surface once it is mounted app-wide —
  move it into the provider.
- The Windows first-join network prompt and the relay fallback
  (`tempo:session-call-relay`) already exist; they move with the provider and keep working
  for conversation calls.
- OS-level notification for an incoming call is a **cross-boundary** change: capability
  detect `window.tempoDesktop`, ship the web behaviour first, and add the native toast in a
  later desktop version with a matching Mac and Windows build.

## 6. Security

Covered fully in `SESSIONS-V2-SECURITY-AND-PERMISSIONS.md`. The short version:

- Membership is always checked server side against the scope's own table.
- A conversation call room name is derived from the conversation id, never accepted from
  the client.
- Leaving a group thread revokes the ability to mint a token immediately; existing tokens
  expire in 2 hours, and the room can be evicted server side if that ever matters.
- Guests exist only in the session scope, and never receive catalog audio.

## 7. Rollout

1. **5a** — provider + dock + `useLiveCall`, Sessions unchanged behaviourally. Nothing
   user-visible except that the call survives navigation.
2. **5b** — scope-aware token route + direct and group calls + ringing.
3. **5c** — artist team threads, then support (staff-initiated).

Each step is independently shippable and independently revertible.
