import { callRoomName } from "@/lib/calls/room-name";

export {
  guestIdentity,
  memberIdentity,
  parseParticipantIdentity,
  type CallParticipantIdentity as SessionParticipantIdentity,
} from "@/lib/calls/room-name";

/** Compatibility wrapper while Session token routes move to the call platform. */
export function sessionRoomName(sessionRoomId: string): string {
  return callRoomName("session", sessionRoomId);
}
