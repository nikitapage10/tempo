import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnvFile } from "../support/e2e-env";
import { loadFixtureManifest } from "../support/fixture-clients";

function adminClient() {
  const env = loadTestEnvFile();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test("pulse-dispatch schedules and processes a due digest end to end (no_content path)", async ({
  request,
}) => {
  const manifest = loadFixtureManifest();
  const admin = adminClient();

  // Force the owner fixture's cadence to be due right now, in a timezone
  // that makes the assertion independent of wall-clock time at test-run.
  // Categories are all off so the digest stays empty even though the fixture
  // owner has tracks and tasks — this path must not need Resend credentials.
  await admin.from("notification_preferences").upsert(
    {
      user_id: manifest.users.owner.id,
      timezone: "UTC",
      digest_frequency: "daily",
      delivery_local_time: "00:00",
      last_digest_window_end: null,
      category_due: false,
      category_attention: false,
      category_feedback: false,
      category_collaboration: false,
      category_messages: false,
      category_calendar: false,
      category_progress: false,
    },
    { onConflict: "user_id" }
  );
  await admin.from("notification_deliveries").delete().eq("user_id", manifest.users.owner.id);
  await admin.from("notifications").delete().eq("user_id", manifest.users.owner.id).eq("type", "dm_message");

  const res = await request.get("/api/cron/pulse-dispatch", {
    headers: { Authorization: "Bearer test-cron-secret-do-not-use-in-prod" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.scheduled).toBeGreaterThanOrEqual(1);

  const { data: deliveries } = await admin
    .from("notification_deliveries")
    .select("status, delivery_kind")
    .eq("user_id", manifest.users.owner.id);
  expect(deliveries).toHaveLength(1);
  expect(deliveries?.[0].status).toBe("no_content");
  expect(deliveries?.[0].delivery_kind).toBe("daily_digest");

  // A second dispatch run within the same window must not create a duplicate.
  const res2 = await request.get("/api/cron/pulse-dispatch", {
    headers: { Authorization: "Bearer test-cron-secret-do-not-use-in-prod" },
  });
  expect(res2.status()).toBe(200);
  const { data: after } = await admin
    .from("notification_deliveries")
    .select("id")
    .eq("user_id", manifest.users.owner.id);
  expect(after).toHaveLength(1);
});

test("pulse-dispatch rejects requests without the cron secret", async ({ request }) => {
  const res = await request.get("/api/cron/pulse-dispatch");
  expect(res.status()).toBe(401);
});

test("unsubscribe with an invalid token returns the same generic page as a valid one", async ({
  request,
}) => {
  const res = await request.get("/api/email/unsubscribe/not-a-real-token-but-long-enough-1234", {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("unsubscribed");
});

test("resend webhook rejects requests without a valid signature", async ({ request }) => {
  const res = await request.post("/api/webhooks/resend", {
    headers: { "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,bogus" },
    data: { type: "email.bounced", data: { to: ["nobody@example.com"] } },
  });
  // 401 if RESEND_WEBHOOK_SECRET is configured (bad signature), 501 if not
  // configured in this test environment — never a 200 without verification.
  expect([401, 501]).toContain(res.status());
});
