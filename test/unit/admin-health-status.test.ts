import { describe, expect, it } from "vitest";
import {
  summarizeSystemHealth,
  type AdminSystemHealth,
} from "@/lib/admin/health-status";

function snapshot(overrides: Partial<AdminSystemHealth> = {}): AdminSystemHealth {
  return {
    migrations: {
      ledgerAvailable: true,
      latestAppliedVersion: 72,
      expectedLatestVersion: 72,
      upToDate: true,
    },
    emailDelivery: {
      configured: true,
      apiKeyPresent: true,
      fromPresent: true,
      domain: "mytempo.dev",
      webhookConfigured: true,
    },
    productEvents: {
      instrumented: true,
      last24h: { accepted: 12, rejected: 0, duplicate: 1 },
    },
    pulseDelivery: {
      instrumented: true,
      pending: 0,
      claimed: 0,
      retry: 0,
      failed: 0,
      oldestPendingScheduledFor: null,
      lastSuccessfulSendAt: "2026-08-12T12:00:00.000Z",
    },
    scheduler: { instrumented: false },
    checkedAt: "2026-08-12T18:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeSystemHealth", () => {
  it("calls a fully green payload Steady and ignores an uninstrumented scheduler", () => {
    const summary = summarizeSystemHealth(snapshot());
    expect(summary.tone).toBe("ok");
    expect(summary.label).toBe("Steady");
    expect(summary.issues).toEqual([]);
  });

  it("surfaces missing email, failed Pulse, and rejected events without secrets", () => {
    const summary = summarizeSystemHealth(
      snapshot({
        emailDelivery: {
          configured: false,
          apiKeyPresent: false,
          fromPresent: false,
          domain: null,
          webhookConfigured: false,
        },
        pulseDelivery: {
          instrumented: true,
          pending: 2,
          claimed: 0,
          retry: 1,
          failed: 3,
          oldestPendingScheduledFor: null,
          lastSuccessfulSendAt: null,
        },
        productEvents: {
          instrumented: true,
          last24h: { accepted: 4, rejected: 2, duplicate: 0 },
        },
      })
    );
    expect(summary.tone).toBe("warn");
    expect(summary.label).toBe("Needs a look");
    expect(summary.issues).toEqual([
      "Invite email isn’t configured",
      "3 Pulse sends failed",
      "1 Pulse retry is waiting",
      "2 product events rejected in 24h",
    ]);
  });
});
