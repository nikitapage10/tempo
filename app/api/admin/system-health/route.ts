import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteDeliveryConfig } from "@/lib/admin/invite-email";
import { EXPECTED_LATEST_MIGRATION } from "@/lib/admin/migration-health";

export const dynamic = "force-dynamic";

/**
 * Guarded operational health surface — AR-2 exit gate: "Health endpoint
 * exposes no secrets or private content." Status/metadata only, ever:
 * migration/capability state, delivery provider configuration presence
 * (never the key itself), and placeholders for surfaces later packages
 * (AR-3 event ingestion, AR-6 scheduler/delivery) will populate.
 */
export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);

  const service = createAdminClient();

  let migrationHealth: {
    ledgerAvailable: boolean;
    latestAppliedVersion: number | null;
    expectedLatestVersion: number;
    upToDate: boolean | null;
  };

  const { data: ledgerRows, error: ledgerError } = await service
    .from("schema_migrations")
    .select("version")
    .order("version", { ascending: false })
    .limit(1);

  if (ledgerError) {
    // Table not present yet (migration 068 not applied here) — a real,
    // visible gap rather than a crash, per AR-2's exit gate.
    migrationHealth = {
      ledgerAvailable: false,
      latestAppliedVersion: null,
      expectedLatestVersion: EXPECTED_LATEST_MIGRATION,
      upToDate: null,
    };
  } else {
    const latest = ledgerRows?.[0]?.version ?? null;
    migrationHealth = {
      ledgerAvailable: true,
      latestAppliedVersion: latest,
      expectedLatestVersion: EXPECTED_LATEST_MIGRATION,
      upToDate: latest !== null ? latest >= EXPECTED_LATEST_MIGRATION : null,
    };
  }

  const emailDelivery = inviteDeliveryConfig();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: accepted }, { count: rejected }, { count: duplicate }] = await Promise.all([
    service.from("product_events").select("id", { count: "exact", head: true }).gte("received_at", since24h),
    service
      .from("product_event_ingestion_errors")
      .select("id", { count: "exact", head: true })
      .in("reason", ["rejected_event_name", "rejected_shape"])
      .gte("created_at", since24h),
    service
      .from("product_event_ingestion_errors")
      .select("id", { count: "exact", head: true })
      .eq("reason", "duplicate")
      .gte("created_at", since24h),
  ]);

  const [
    { count: pendingCount },
    { count: claimedCount },
    { count: retryCount },
    { count: failedCount },
    { data: oldestPending },
    { data: lastSent },
  ] = await Promise.all([
    service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("status", "claimed"),
    service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("status", "retry"),
    service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    service
      .from("notification_deliveries")
      .select("scheduled_for")
      .in("status", ["pending", "retry"])
      .order("scheduled_for", { ascending: true })
      .limit(1),
    service
      .from("notification_deliveries")
      .select("sent_at")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);

  return adminJson({
    migrations: migrationHealth,
    emailDelivery: {
      configured: emailDelivery.configured,
      apiKeyPresent: emailDelivery.apiKeyPresent,
      fromPresent: emailDelivery.fromPresent,
      domain: emailDelivery.domain,
      webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
    },
    productEvents: {
      instrumented: true,
      last24h: {
        accepted: accepted ?? 0,
        rejected: rejected ?? 0,
        duplicate: duplicate ?? 0,
      },
    },
    pulseDelivery: {
      instrumented: true,
      pending: pendingCount ?? 0,
      claimed: claimedCount ?? 0,
      retry: retryCount ?? 0,
      failed: failedCount ?? 0,
      oldestPendingScheduledFor: oldestPending?.[0]?.scheduled_for ?? null,
      lastSuccessfulSendAt: lastSent?.[0]?.sent_at ?? null,
    },
    // Populated once the corresponding package ships — reported explicitly
    // as "not yet instrumented" rather than omitted, so the Admin surface
    // never implies a false "healthy" for something that doesn't exist yet.
    scheduler: { instrumented: false },
    checkedAt: new Date().toISOString(),
  });
}
