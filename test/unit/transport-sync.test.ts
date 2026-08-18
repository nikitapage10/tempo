import { describe, expect, it } from "vitest";
import {
  expectedTransportPosition,
  shouldCorrectTransport,
} from "@/lib/calls/transport-sync";

describe("shared deck transport", () => {
  it("ages playing packets from local receipt time only", () => {
    expect(expectedTransportPosition(10, true, 2500, 2000)).toBe(10.5);
    expect(expectedTransportPosition(10, false, 2500, 2000)).toBe(10);
  });

  it("corrects drift only past 350ms", () => {
    expect(shouldCorrectTransport(10, 10.35)).toBe(false);
    expect(shouldCorrectTransport(10, 10.36)).toBe(true);
  });
});
