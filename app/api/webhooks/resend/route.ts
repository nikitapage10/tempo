import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suppress } from "@/lib/pulse/suppression";

export const dynamic = "force-dynamic";

/**
 * Verifies a Resend (Svix-format) webhook signature without adding the
 * `svix` dependency — the scheme is documented and simple enough to
 * implement directly: HMAC-SHA256 over `${id}.${timestamp}.${body}` using
 * the base64 portion of the signing secret (after its "whsec_" prefix),
 * compared against one of the space-separated `v1,<sig>` values in the
 * svix-signature header.
 */
function verifySignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  svixSignatureHeader: string
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const candidates = svixSignatureHeader.split(" ").map((v) => v.split(",")[1]).filter(Boolean);
  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

/**
 * POST /api/webhooks/resend — delivered/bounced/complained events for
 * Pulse digests. Never logs the raw request body; provider event IDs make
 * this idempotent against Resend's at-least-once delivery.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 501 });

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers." }, { status: 400 });
  }

  const rawBody = await req.text();
  if (!verifySignature(secret, svixId, svixTimestamp, rawBody, svixSignature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const providerId = payload.data?.email_id;
  const eventType = payload.type ?? "";
  const to = payload.data?.to?.[0];

  if (eventType === "email.delivered" && providerId) {
    await admin.from("notification_deliveries").update({ status: "sent" }).eq("provider_message_id", providerId);
  } else if ((eventType === "email.bounced" || eventType === "email.complained") && to) {
    const reason = eventType === "email.bounced" ? "hard_bounce" : "complaint";
    // provider_event_id (svix-id) makes repeated webhook delivery idempotent
    // via the unique constraint — a duplicate insert is expected, not an error.
    await suppress(admin, { userId: null, email: to, reason, providerEventId: svixId });
    if (providerId) {
      await admin.from("notification_deliveries").update({ status: "failed", error_class: "permanent", error_message: reason }).eq("provider_message_id", providerId);
    }
  }

  return NextResponse.json({ ok: true });
}
