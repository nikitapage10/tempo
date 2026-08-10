import { describe, expect, it } from "vitest";
import {
  isDigestDue,
  digestWindowKey,
  deliveryDedupeKey,
  decideRetry,
  classifyEmailFailure,
  isClaimExpired,
  type CadenceInput,
} from "../../lib/pulse/scheduling";

function cadence(overrides: Partial<CadenceInput> = {}): CadenceInput {
  return {
    frequency: "daily",
    timezone: "America/Denver",
    localTime: "08:00",
    weeklyDay: null,
    pausedUntil: null,
    lastWindowEnd: null,
    ...overrides,
  };
}

describe("isDigestDue", () => {
  it("is false when frequency is off", () => {
    const c = cadence({ frequency: "off" });
    expect(isDigestDue(c, new Date("2026-08-10T15:00:00Z"))).toBe(false);
  });

  it("is false before the local delivery time", () => {
    // 08:00 UTC is 02:00 America/Denver (MDT, UTC-6) in August — before 08:00 local.
    const c = cadence({ localTime: "08:00" });
    expect(isDigestDue(c, new Date("2026-08-10T08:00:00Z"))).toBe(false);
  });

  it("is true once local time reaches the delivery time", () => {
    // 14:05 UTC = 08:05 America/Denver (MDT, UTC-6) in August.
    const c = cadence({ localTime: "08:00" });
    expect(isDigestDue(c, new Date("2026-08-10T14:05:00Z"))).toBe(true);
  });

  it("does not fire again the same local day once already recorded", () => {
    const c = cadence({ localTime: "08:00", lastWindowEnd: digestWindowKey("daily", "2026-08-10") });
    expect(isDigestDue(c, new Date("2026-08-10T15:00:00Z"))).toBe(false);
  });

  it("fires again the next local day even with the same UTC hour", () => {
    const c = cadence({ localTime: "08:00", lastWindowEnd: digestWindowKey("daily", "2026-08-10") });
    expect(isDigestDue(c, new Date("2026-08-11T15:00:00Z"))).toBe(true);
  });

  it("respects weekly cadence — only fires on the configured weekday", () => {
    // 2026-08-10 is a Monday.
    const c = cadence({ frequency: "weekly", weeklyDay: 1, localTime: "08:00" });
    expect(isDigestDue(c, new Date("2026-08-10T15:00:00Z"))).toBe(true);
    expect(isDigestDue(c, new Date("2026-08-11T15:00:00Z"))).toBe(false); // Tuesday
  });

  it("respects a pause through the paused date, inclusive", () => {
    const c = cadence({ pausedUntil: "2026-08-10" });
    expect(isDigestDue(c, new Date("2026-08-10T15:00:00Z"))).toBe(false);
    expect(isDigestDue(c, new Date("2026-08-11T15:00:00Z"))).toBe(true);
  });

  it("handles a different timezone independently of server/UTC time", () => {
    // 07:05 UTC = 08:05 in Europe/London (BST, UTC+1) in August.
    const c = cadence({ timezone: "Europe/London", localTime: "08:00" });
    expect(isDigestDue(c, new Date("2026-08-10T07:05:00Z"))).toBe(true);
    expect(isDigestDue(c, new Date("2026-08-10T06:55:00Z"))).toBe(false);
  });
});

describe("digestWindowKey / deliveryDedupeKey", () => {
  it("produces a stable, distinct key per frequency+date", () => {
    expect(digestWindowKey("daily", "2026-08-10")).toBe("daily:2026-08-10");
    expect(digestWindowKey("weekly", "2026-08-10")).not.toBe(digestWindowKey("daily", "2026-08-10"));
  });

  it("produces a stable per-user/kind/window dedupe key", () => {
    const key = deliveryDedupeKey("user-1", "daily_digest", "daily:2026-08-10");
    expect(key).toBe("user-1:daily_digest:daily:2026-08-10");
  });
});

describe("decideRetry", () => {
  it("retries with increasing backoff for the first several attempts", () => {
    const now = new Date("2026-08-10T00:00:00Z");
    const first = decideRetry(0, now);
    const second = decideRetry(1, now);
    expect(first.action).toBe("retry");
    expect(second.action).toBe("retry");
    if (first.action === "retry" && second.action === "retry") {
      expect(new Date(first.nextAttemptAt).getTime()).toBeLessThan(new Date(second.nextAttemptAt).getTime());
    }
  });

  it("stops retrying after the max attempt count (terminal failure)", () => {
    const now = new Date("2026-08-10T00:00:00Z");
    expect(decideRetry(5, now)).toEqual({ action: "fail_terminal" });
    expect(decideRetry(10, now)).toEqual({ action: "fail_terminal" });
  });
});

describe("classifyEmailFailure", () => {
  it("classifies 4xx (except 429) as permanent", () => {
    expect(classifyEmailFailure("bad request", 400)).toBe("permanent");
    expect(classifyEmailFailure("rate limited", 429)).toBe("transient");
  });

  it("classifies 5xx as transient", () => {
    expect(classifyEmailFailure("server error", 500)).toBe("transient");
  });

  it("classifies an invalid-address message as permanent even without a status", () => {
    expect(classifyEmailFailure("The email address is invalid")).toBe("permanent");
  });

  it("defaults unknown errors to transient (retry, don't silently drop)", () => {
    expect(classifyEmailFailure("something weird happened")).toBe("transient");
  });
});

describe("isClaimExpired", () => {
  it("is false when there is no claim", () => {
    expect(isClaimExpired(null, new Date())).toBe(false);
  });

  it("is true once the lease time has passed", () => {
    expect(
      isClaimExpired("2026-08-10T00:00:00Z", new Date("2026-08-10T00:05:00Z"))
    ).toBe(true);
  });

  it("is false before the lease expires", () => {
    expect(
      isClaimExpired("2026-08-10T00:10:00Z", new Date("2026-08-10T00:05:00Z"))
    ).toBe(false);
  });
});
