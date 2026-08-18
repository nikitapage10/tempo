export type CallPacket =
  | { kind: "chat" }
  | { kind: "transport"; versionId: string; positionSec: number; playing: boolean; atMs: number }
  | { kind: "deck"; versionId: string | null; byIdentity: string }
  | { kind: "marker"; commentId: string; versionId: string; timestampSec: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodePacket(packet: CallPacket): Uint8Array<ArrayBuffer> {
  const encoded = encoder.encode(JSON.stringify(packet));
  return new Uint8Array(encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer);
}

export function decodePacket(payload: Uint8Array): CallPacket | null {
  try {
    const value = JSON.parse(decoder.decode(payload)) as Record<string, unknown>;
    if (value.kind === "chat") return { kind: "chat" };
    if (
      value.kind === "transport" &&
      typeof value.versionId === "string" &&
      typeof value.positionSec === "number" &&
      Number.isFinite(value.positionSec) &&
      typeof value.playing === "boolean" &&
      typeof value.atMs === "number"
    ) {
      return value as CallPacket;
    }
    if (
      value.kind === "deck" &&
      (typeof value.versionId === "string" || value.versionId === null) &&
      typeof value.byIdentity === "string"
    ) {
      return value as CallPacket;
    }
    if (
      value.kind === "marker" &&
      typeof value.commentId === "string" &&
      typeof value.versionId === "string" &&
      typeof value.timestampSec === "number"
    ) {
      return value as CallPacket;
    }
  } catch {
    return null;
  }
  return null;
}
