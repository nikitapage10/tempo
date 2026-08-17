import { describe, expect, it } from "vitest";
import {
  isLinkLocked,
  makePasscodeRecord,
  registerPasscodeFailure,
  SESSION_LINK_MAX_FAILURES,
  verifyPasscode,
} from "@/lib/sessions/link";

describe("Session link passcodes", () => {
  it("verifies a passcode against its scrypt record", () => {
    const record = makePasscodeRecord("studio-night");
    expect(verifyPasscode("studio-night", record.saltHex, record.hashHex)).toBe(true);
    expect(verifyPasscode("wrong", record.saltHex, record.hashHex)).toBe(false);
  });

  it("locks after eight failures for 15 minutes", () => {
    const now = new Date("2026-08-17T12:00:00.000Z");
    let failed = 0;
    let lockedUntil: Date | null = null;
    for (let i = 0; i < SESSION_LINK_MAX_FAILURES; i += 1) {
      const next = registerPasscodeFailure(failed, now);
      failed = next.failedAttempts;
      lockedUntil = next.lockedUntil;
    }
    expect(failed).toBe(8);
    expect(lockedUntil).not.toBeNull();
    expect(isLinkLocked(lockedUntil, now)).toBe(true);
    expect(isLinkLocked(lockedUntil, new Date(now.getTime() + 14 * 60 * 1000))).toBe(true);
    expect(isLinkLocked(lockedUntil, new Date(now.getTime() + 16 * 60 * 1000))).toBe(false);
  });
});
