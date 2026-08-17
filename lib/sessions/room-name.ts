/** LiveKit room name for a Session. Stable across hangs. */
export function sessionRoomName(sessionRoomId: string): string {
  return `tempo-session-${sessionRoomId}`;
}

export type SessionParticipantIdentity =
  | { kind: "member"; id: string }
  | { kind: "guest"; id: string };

export function memberIdentity(userId: string): string {
  return `u:${userId}`;
}

export function guestIdentity(guestId: string): string {
  return `g:${guestId}`;
}

/** Malformed identities return null rather than throwing. A guest identity never parses as a member. */
export function parseParticipantIdentity(
  identity: string | null | undefined
): SessionParticipantIdentity | null {
  if (!identity) return null;
  if (identity.startsWith("u:") && identity.length > 2) {
    return { kind: "member", id: identity.slice(2) };
  }
  if (identity.startsWith("g:") && identity.length > 2) {
    return { kind: "guest", id: identity.slice(2) };
  }
  return null;
}
