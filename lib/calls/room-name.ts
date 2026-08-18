export type CallScope = "session" | "conversation" | "support";

export function callRoomName(scope: CallScope, id: string): string {
  return `tempo-${scope}-${id}`;
}

export type CallParticipantIdentity =
  | { kind: "member"; id: string }
  | { kind: "guest"; id: string };

export function memberIdentity(userId: string): string {
  return `u:${userId}`;
}

export function guestIdentity(guestId: string): string {
  return `g:${guestId}`;
}

export function parseParticipantIdentity(identity: string | null | undefined): CallParticipantIdentity | null {
  if (!identity) return null;
  if (identity.startsWith("u:") && identity.length > 2) return { kind: "member", id: identity.slice(2) };
  if (identity.startsWith("g:") && identity.length > 2) return { kind: "guest", id: identity.slice(2) };
  return null;
}
