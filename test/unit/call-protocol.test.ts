import { describe, expect, it } from "vitest";
import { decodePacket, encodePacket } from "@/lib/calls/protocol";

describe("call packet protocol", () => {
  it("round-trips supported packets", () => {
    const packet = { kind: "transport" as const, versionId: "v1", positionSec: 42.5, playing: true, atMs: 10 };
    expect(decodePacket(encodePacket(packet))).toEqual(packet);
  });

  it("ignores unknown and malformed packets", () => {
    expect(decodePacket(new TextEncoder().encode('{"kind":"future"}'))).toBeNull();
    expect(decodePacket(new TextEncoder().encode("{bad"))).toBeNull();
    expect(decodePacket(new TextEncoder().encode('{"kind":"transport"}'))).toBeNull();
  });
});
