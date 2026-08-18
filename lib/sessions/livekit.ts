/**
 * Server-only LiveKit token minting. The API key never leaves this module.
 */

import { AccessToken } from "livekit-server-sdk";
import { callRoomName, guestIdentity, memberIdentity, type CallScope } from "@/lib/calls/room-name";

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.NEXT_PUBLIC_LIVEKIT_URL
  );
}

export const LIVEKIT_UNAVAILABLE_MESSAGE = "Calls are not switched on right now.";

export async function mintCallToken(input: {
  scope: CallScope;
  targetId: string;
  kind: "member" | "guest";
  id: string;
  displayName: string;
  canPublish: boolean;
  ttlSeconds: number;
  metadata?: Record<string, string>;
}): Promise<{ token: string; url: string; roomName: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    throw new Error(LIVEKIT_UNAVAILABLE_MESSAGE);
  }

  const identity = input.kind === "guest" ? guestIdentity(input.id) : memberIdentity(input.id);
  const roomName = callRoomName(input.scope, input.targetId);
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: input.displayName,
    ttl: input.ttlSeconds,
    metadata: JSON.stringify({
      role: input.kind,
      ...input.metadata,
    }),
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: input.canPublish,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  return { token: await token.toJwt(), url, roomName };
}

export function mintSessionLiveKitToken(
  input: Omit<Parameters<typeof mintCallToken>[0], "scope" | "targetId"> & { sessionRoomId: string },
) {
  return mintCallToken({ ...input, scope: "session", targetId: input.sessionRoomId });
}
