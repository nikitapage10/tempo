import { NextResponse, type NextRequest } from "next/server";
import { provisionStarterCommunity } from "@/lib/onboarding-starter-community";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Publish an artist to the member network and reconcile the account's Green
 * Room membership as one user-visible action. The older client-only update
 * could succeed while first-run community provisioning had not finished,
 * leaving a newly joined artist with no starter Scene.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  }

  const body = await request.json().catch(() => null);
  const artistId = typeof body?.artistId === "string" ? body.artistId : "";
  const visibility = body?.visibility;
  if (!artistId || (visibility !== "members" && visibility !== "public")) {
    return NextResponse.json({ error: "Choose a valid network visibility." }, { status: 400, headers });
  }

  const { data: existing, error: readError } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("artist_id", artistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (readError || !existing) {
    return NextResponse.json(
      { error: "Shape and save the artist profile before joining the network." },
      { status: 404, headers }
    );
  }

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("demo_kind")
    .eq("id", artistId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (artistError || !artist) {
    return NextResponse.json(
      { error: "Couldn’t verify this artist." },
      { status: 404, headers }
    );
  }
  if (artist?.demo_kind) {
    return NextResponse.json(
      { error: "Demo artists stay separate from the live member network." },
      { status: 400, headers }
    );
  }

  const publishedAt = existing.published_at ?? new Date().toISOString();
  const { data: profile, error: publishError } = await supabase
    .from("artist_profiles")
    .update({ visibility, published_at: publishedAt })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (publishError || !profile) {
    return NextResponse.json(
      { error: publishError?.message ?? "Couldn’t join the network." },
      { status: 500, headers }
    );
  }

  try {
    const service = createAdminClient();
    await service.rpc("provision_member_onboarding", { p_user_id: user.id });
    const provisioned = await provisionStarterCommunity(service, user.id);
    if (!provisioned) throw new Error("The Green Room is not ready yet.");
    await service
      .from("member_onboarding")
      .update({ starter_community_provisioned_at: new Date().toISOString() })
      .eq("user_id", user.id);
  } catch (error) {
    // Roll the visible choice back if its promised starter membership could not
    // be reconciled. The next attempt is safe: provisioning is idempotent.
    await supabase
      .from("artist_profiles")
      .update({ visibility: existing.visibility, published_at: existing.published_at })
      .eq("id", existing.id);
    const message = error instanceof Error ? error.message : "Couldn’t join the Green Room.";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }

  return NextResponse.json(profile, { headers });
}
