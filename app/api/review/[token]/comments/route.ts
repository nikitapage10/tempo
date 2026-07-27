import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUEST_COMMENT_BURST_LIMIT,
  GUEST_COMMENT_BURST_WINDOW_MS,
  GUEST_COMMENT_MAX_LEN,
  GUEST_LINK_UNAVAILABLE_MESSAGE,
  GUEST_NAME_MAX_LEN,
  noStoreHeaders,
  resolveGuestLink,
} from "@/lib/guest-review";

export const dynamic = "force-dynamic";

const GENERIC_POST_ERROR =
  "Couldn’t post that comment right now — try again in a moment.";

/**
 * GET /api/review/[token]/comments — comments for the linked version only,
 * an allowlisted subset of columns (no assigned_to_user_id / resolved_by /
 * guest_link_id). Read access does not depend on `allow_comments` — that
 * flag only gates posting.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveGuestLink(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("comments")
    .select("id, text, timestamp_sec, parent_id, guest_name, author_user_id, resolved, created_at")
    .eq("version_id", ctx.version.id)
    .order("timestamp_sec", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 500, headers: noStoreHeaders() }
    );
  }

  const comments = (data ?? []).map((c) => ({
    id: c.id,
    text: c.text,
    timestamp_sec: c.timestamp_sec,
    parent_id: c.parent_id,
    resolved: c.resolved,
    created_at: c.created_at,
    author_label: c.guest_name ? `Guest: ${c.guest_name}` : c.author_user_id ? "Studio" : "Guest",
  }));

  return NextResponse.json({ comments }, { headers: noStoreHeaders() });
}

/**
 * POST /api/review/[token]/comments — creates a guest comment. Guests never
 * reply, resolve, edit, or delete in v1 (SECURITY-AND-PERMISSIONS.md §3).
 * Honeypot + burst limit + length limits guard against abuse without adding
 * a CAPTCHA dependency (SECURITY-AND-PERMISSIONS.md §T8).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const ctx = await resolveGuestLink(params.token);
  if (!ctx) {
    return NextResponse.json(
      { error: GUEST_LINK_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  if (!ctx.link.allow_comments) {
    return NextResponse.json(
      { error: "Comments are turned off for this link." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: GENERIC_POST_ERROR },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: GENERIC_POST_ERROR },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const { guest_name, text, timestamp_sec, website } = body as Record<string, unknown>;

  // Honeypot — bots that fill hidden fields get a quiet fake success.
  if (typeof website === "string" && website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  const trimmedText = typeof text === "string" ? text.trim() : "";
  if (!trimmedText) {
    return NextResponse.json(
      { error: "Write something before posting." },
      { status: 400, headers: noStoreHeaders() }
    );
  }
  if (trimmedText.length > GUEST_COMMENT_MAX_LEN) {
    return NextResponse.json(
      { error: `Keep comments under ${GUEST_COMMENT_MAX_LEN} characters.` },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  const trimmedName =
    typeof guest_name === "string" ? guest_name.trim().slice(0, GUEST_NAME_MAX_LEN) : "";

  let timestampSec: number | null = null;
  if (typeof timestamp_sec === "number" && Number.isFinite(timestamp_sec)) {
    const maxDuration = ctx.version.duration ?? Number.MAX_SAFE_INTEGER;
    timestampSec = Math.min(Math.max(0, timestamp_sec), maxDuration + 5);
  }

  const admin = createAdminClient();

  const since = new Date(Date.now() - GUEST_COMMENT_BURST_WINDOW_MS).toISOString();
  const { count: recentCount, error: countError } = await admin
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("guest_link_id", ctx.link.id)
    .gte("created_at", since);

  if (countError) {
    return NextResponse.json(
      { error: GENERIC_POST_ERROR },
      { status: 500, headers: noStoreHeaders() }
    );
  }
  if ((recentCount ?? 0) >= GUEST_COMMENT_BURST_LIMIT) {
    return NextResponse.json(
      { error: "Too many comments right now — try again in a few minutes." },
      { status: 429, headers: noStoreHeaders() }
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("comments")
    .insert({
      track_id: ctx.track.id,
      version_id: ctx.version.id,
      text: trimmedText,
      timestamp_sec: timestampSec,
      guest_name: trimmedName || "Guest",
      guest_link_id: ctx.link.id,
      author_user_id: null,
      parent_id: null,
      resolved: false,
    })
    .select("id, text, timestamp_sec, guest_name, resolved, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: GENERIC_POST_ERROR },
      { status: 500, headers: noStoreHeaders() }
    );
  }

  return NextResponse.json(
    {
      comment: {
        id: inserted.id,
        text: inserted.text,
        timestamp_sec: inserted.timestamp_sec,
        resolved: inserted.resolved,
        created_at: inserted.created_at,
        author_label: `Guest: ${inserted.guest_name}`,
      },
    },
    { status: 201, headers: noStoreHeaders() }
  );
}
