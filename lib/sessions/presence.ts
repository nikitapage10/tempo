export type SessionPresenceParticipant = {
  identity: string;
  attributes?: Record<string, string>;
  isLocal?: boolean;
};

/**
 * Split LiveKit participants into everyone in the room vs people on the call.
 * "On the call" is an explicit attribute, not an inference from published tracks.
 * Someone can be on the call fully muted.
 */
export function splitRoster(participants: SessionPresenceParticipant[]): {
  inRoom: SessionPresenceParticipant[];
  onCall: SessionPresenceParticipant[];
} {
  const seen = new Set<string>();
  const inRoom: SessionPresenceParticipant[] = [];
  for (const participant of participants) {
    if (!participant.identity || seen.has(participant.identity)) continue;
    seen.add(participant.identity);
    inRoom.push(participant);
  }
  return {
    inRoom,
    onCall: inRoom.filter((participant) => participant.attributes?.oncall === "1"),
  };
}
