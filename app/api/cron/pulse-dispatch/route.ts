import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isDigestDue,
  digestWindowKey,
  deliveryDedupeKey,
  decideRetry,
  classifyEmailFailure,
  isClaimExpired,
  type CadenceInput,
} from "@/lib/pulse/scheduling";
import { isSuppressed, ensurePreferenceToken } from "@/lib/pulse/suppression";
import { aggregatePulseItemsForUser } from "@/lib/pulse/aggregate-server";
import { renderDigestEmail, sendDigestEmail } from "@/lib/pulse/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CLAIM_LEASE_MINUTES = 5;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const cronHeader = req.headers.get("x-vercel-cron-auth");
  if (cronHeader && cronHeader === secret) return true;
  return false;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tempo-ten-sigma.vercel.app").replace(/\/$/, "");
}

/**
 * GET/POST /api/cron/pulse-dispatch — schedules due digests, atomically
 * claims a bounded batch, re-authorizes and aggregates fresh at send time,
 * and sends through Resend. Every step matches
 * 02-TECHNICAL-AND-DATA-DESIGN.md §7:
 *   1. Find users whose local cadence is due.
 *   2. Create one delivery row per user/window (idempotent via dedupe_key).
 *   3. Atomically claim pending/retry rows (conditional UPDATE — a single
 *      row-level UPDATE...WHERE status='pending' is what makes two
 *      concurrent workers race safely: only one's WHERE clause matches).
 *   4. Recheck suppression + preferences; aggregate fresh.
 *   5. Empty -> no_content. Otherwise render, send, mark sent.
 *   6. Failure -> classify and retry with backoff, or fail terminal.
 */
async function run(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: prefRows, error: prefError } = await admin
    .from("notification_preferences")
    .select("*")
    .neq("digest_frequency", "off");
  if (prefError) {
    return NextResponse.json({ error: "Could not read preferences." }, { status: 500 });
  }

  let scheduled = 0;
  for (const pref of prefRows ?? []) {
    const cadence: CadenceInput = {
      frequency: pref.digest_frequency,
      timezone: pref.timezone,
      localTime: pref.delivery_local_time?.slice(0, 5) ?? "08:00",
      weeklyDay: pref.weekly_delivery_day,
      pausedUntil: pref.paused_until,
      lastWindowEnd: pref.last_digest_window_end,
    };
    if (!isDigestDue(cadence, now)) continue;

    const local = new Intl.DateTimeFormat("en-CA", { timeZone: pref.timezone }).format(now); // YYYY-MM-DD
    const windowKey = digestWindowKey(pref.digest_frequency, local);
    const kind = pref.digest_frequency === "daily" ? "daily_digest" : "weekly_digest";
    const dedupeKey = deliveryDedupeKey(pref.user_id, kind, windowKey);

    const { error: insertError } = await admin.from("notification_deliveries").insert({
      user_id: pref.user_id,
      delivery_kind: kind,
      scheduled_for: now.toISOString(),
      status: "pending",
      dedupe_key: dedupeKey,
    });
    // Unique violation = already scheduled for this window; expected, not an error.
    if (!insertError) scheduled += 1;
  }

  // Recover expired claims back to retry before claiming a fresh batch.
  const { data: expiredClaims } = await admin
    .from("notification_deliveries")
    .select("id, claim_expires_at")
    .eq("status", "claimed");
  for (const row of expiredClaims ?? []) {
    if (isClaimExpired(row.claim_expires_at, now)) {
      await admin.from("notification_deliveries").update({ status: "retry" }).eq("id", row.id);
    }
  }

  const { data: due } = await admin
    .from("notification_deliveries")
    .select("*")
    .in("status", ["pending", "retry"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .order("scheduled_for", { ascending: true })
    .limit(25);

  let sent = 0;
  let noContent = 0;
  let failed = 0;
  let retried = 0;

  for (const row of due ?? []) {
    const claimExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MINUTES * 60_000).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("notification_deliveries")
      .update({ status: "claimed", claimed_at: now.toISOString(), claim_expires_at: claimExpiresAt })
      .eq("id", row.id)
      .in("status", ["pending", "retry"]) // atomic: only succeeds if still unclaimed
      .select()
      .maybeSingle();
    if (claimError || !claimed) continue; // another worker won the race

    try {
      const { data: authUser } = await admin.auth.admin.getUserById(claimed.user_id);
      const email = authUser?.user?.email;
      if (!email) {
        await admin.from("notification_deliveries").update({ status: "failed", error_class: "permanent", error_message: "No email on file." }).eq("id", claimed.id);
        failed += 1;
        continue;
      }

      if (await isSuppressed(admin, claimed.user_id, email)) {
        await admin.from("notification_deliveries").update({ status: "suppressed" }).eq("id", claimed.id);
        continue;
      }

      const { data: freshPref } = await admin
        .from("notification_preferences")
        .select("*")
        .eq("user_id", claimed.user_id)
        .maybeSingle();
      if (!freshPref || freshPref.digest_frequency === "off") {
        await admin.from("notification_deliveries").update({ status: "cancelled" }).eq("id", claimed.id);
        continue;
      }

      const items = await aggregatePulseItemsForUser(admin, claimed.user_id);
      if (items.length === 0) {
        await admin
          .from("notification_deliveries")
          .update({ status: "no_content", item_counts: {} })
          .eq("id", claimed.id);
        await admin
          .from("notification_preferences")
          .update({ last_digest_window_end: digestWindowKey(freshPref.digest_frequency, new Date().toISOString().slice(0, 10)) })
          .eq("user_id", claimed.user_id);
        noContent += 1;
        continue;
      }

      const rawToken = await ensurePreferenceToken(admin, claimed.user_id);
      const message = renderDigestEmail({
        kind: claimed.delivery_kind,
        items,
        includeEntityNames: freshPref.include_entity_names,
        manageUrl: `${siteUrl()}/settings?tab=notifications`,
        unsubscribeUrl: `${siteUrl()}/api/email/unsubscribe/${rawToken}`,
      });

      const result = await sendDigestEmail({ to: email, message, idempotencyKey: claimed.dedupe_key });

      await admin
        .from("notification_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerId,
          item_counts: { messages: items.length },
        })
        .eq("id", claimed.id);
      await admin
        .from("notification_preferences")
        .update({ last_digest_window_end: digestWindowKey(freshPref.digest_frequency, new Date().toISOString().slice(0, 10)) })
        .eq("user_id", claimed.user_id);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const httpStatus = (err as { httpStatus?: number })?.httpStatus;
      const failureClass = classifyEmailFailure(message, httpStatus);
      const decision =
        failureClass === "permanent" ? { action: "fail_terminal" as const } : decideRetry(claimed.attempt_count + 1, now);

      if (decision.action === "fail_terminal") {
        await admin
          .from("notification_deliveries")
          .update({ status: "failed", attempt_count: claimed.attempt_count + 1, error_class: failureClass, error_message: message.slice(0, 500) })
          .eq("id", claimed.id);
        failed += 1;
      } else {
        await admin
          .from("notification_deliveries")
          .update({ status: "retry", attempt_count: claimed.attempt_count + 1, next_attempt_at: decision.nextAttemptAt, error_class: failureClass, error_message: message.slice(0, 500) })
          .eq("id", claimed.id);
        retried += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, scheduled, claimed: (due ?? []).length, sent, noContent, failed, retried });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
