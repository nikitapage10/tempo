export type AdminSystemHealth = {
  migrations: {
    ledgerAvailable: boolean;
    latestAppliedVersion: number | null;
    expectedLatestVersion: number;
    upToDate: boolean | null;
  };
  emailDelivery: {
    configured: boolean;
    apiKeyPresent: boolean;
    fromPresent: boolean;
    domain: string | null;
    webhookConfigured: boolean;
  };
  productEvents: {
    instrumented: boolean;
    last24h: { accepted: number; rejected: number; duplicate: number };
  };
  pulseDelivery: {
    instrumented: boolean;
    pending: number;
    claimed: number;
    retry: number;
    failed: number;
    oldestPendingScheduledFor: string | null;
    lastSuccessfulSendAt: string | null;
  };
  scheduler: { instrumented: boolean };
  checkedAt: string;
};

export type SystemHealthSummary = {
  tone: "ok" | "warn";
  label: string;
  issues: string[];
};

/**
 * Turn the guarded health payload into a short operational read.
 * Uninstrumented surfaces are not treated as failures.
 */
export function summarizeSystemHealth(data: AdminSystemHealth): SystemHealthSummary {
  const issues: string[] = [];
  if (!data.emailDelivery.configured) {
    issues.push("Invite email isn’t configured");
  }
  if (data.migrations.upToDate === false) {
    issues.push(
      `Schema is behind (applied ${data.migrations.latestAppliedVersion ?? "none"}, expected ${data.migrations.expectedLatestVersion})`
    );
  } else if (!data.migrations.ledgerAvailable) {
    issues.push("Migration ledger isn’t available yet");
  }
  if (data.pulseDelivery.instrumented && data.pulseDelivery.failed > 0) {
    issues.push(
      `${data.pulseDelivery.failed} Pulse ${data.pulseDelivery.failed === 1 ? "send" : "sends"} failed`
    );
  }
  if (data.pulseDelivery.instrumented && data.pulseDelivery.retry > 0) {
    issues.push(
      `${data.pulseDelivery.retry} Pulse ${data.pulseDelivery.retry === 1 ? "retry is" : "retries are"} waiting`
    );
  }
  if (data.productEvents.instrumented && data.productEvents.last24h.rejected > 0) {
    issues.push(
      `${data.productEvents.last24h.rejected} product ${data.productEvents.last24h.rejected === 1 ? "event" : "events"} rejected in 24h`
    );
  }
  if (issues.length === 0) {
    return { tone: "ok", label: "Steady", issues };
  }
  return { tone: "warn", label: "Needs a look", issues };
}
