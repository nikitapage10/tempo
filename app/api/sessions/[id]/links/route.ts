import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateLinkToken,
  makePasscodeRecord,
  SESSION_PASSCODE_MIN_LENGTH,
  sha256Hex,
} from "@/lib/sessions/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { data: host } = await supabase.rpc("is_session_host", { p_room_id: params.id });
  if (!host) {
    return NextResponse.json({ error: "Only a host can share this Session." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  if (passcode.length < SESSION_PASSCODE_MIN_LENGTH) {
    return NextResponse.json({ error: "Use at least 6 characters for the passcode." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const token = generateLinkToken();
  const record = makePasscodeRecord(passcode);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_links")
    .insert({
      session_room_id: params.id,
      token_hash: sha256Hex(token),
      passcode_salt: record.saltHex,
      passcode_hash: record.hashHex,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Couldn’t create that link." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytempo.dev";
  return NextResponse.json(
    { url: `${origin.replace(/\/$/, "")}/join/${token}`, passcode, token },
    { headers: { "Cache-Control": "no-store" } }
  );
}
