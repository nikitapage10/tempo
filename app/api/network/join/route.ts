import { NextResponse, type NextRequest } from "next/server";
import { provisionStarterCommunity } from "@/lib/onboarding-starter-community";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { connectTeamNetworkFollows } from "@/lib/social/connect-team-follows";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Publish an owned workspace (music artist or personal home) to the member
 * network. Creates the public identity row if this person has never shaped
 * an Artist page — team members still need to be able to join Social.
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
  let artistId = typeof body?.artistId === "string" ? body.artistId : "";
  const visibility = body?.visibility;
  if (visibility !== "members" && visibility !== "public") {
    return NextResponse.json({ error: "Choose a valid network visibility." }, { status: 400, headers });
  }

  if (!artistId) {
    const { data: owned } = await supabase
      .from("artists")
      .select("id, workspace_kind")
      .eq("user_id", user.id)
      .is("demo_kind", null)
      .order("sort", { ascending: true });
    const personal = owned?.find((row) => row.workspace_kind === "personal");
    artistId = personal?.id ?? owned?.[0]?.id ?? "";
  }
  if (!artistId) {
    return NextResponse.json(
      { error: "Couldn't find a workspace to join from." },
      { status: 404, headers }
    );
  }

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("name, emblem_url, banner_url, banner_color, banner_color_end, ice_color, amber_color, palette_id, demo_kind")
    .eq("id", artistId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (artistError || !artist) {
    return NextResponse.json(
      { error: "Couldn't verify this workspace." },
      { status: 404, headers }
    );
  }
  if (artist.demo_kind) {
    return NextResponse.json(
      { error: "Demo artists stay separate from the live member network." },
      { status: 400, headers }
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("artist_id", artistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json(
      { error: "Couldn't load your network identity." },
      { status: 500, headers }
    );
  }

  let profileId = existing?.id as string | undefined;
  if (!existing) {
    const { data: memberProfile } = await supabase
      .from("artist_member_profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    const displayName =
      (typeof memberProfile?.display_name === "string" && memberProfile.display_name.trim()) ||
      artist.name ||
      user.email?.split("@")[0] ||
      "Member";
    const { data: created, error: createError } = await supabase
      .from("artist_profiles")
      .insert({
        artist_id: artistId,
        owner_user_id: user.id,
        display_name: displayName.slice(0, 80),
        emblem_url: memberProfile?.avatar_url ?? artist.emblem_url ?? null,
        banner_url: artist.banner_url ?? null,
        banner_color: artist.banner_color ?? null,
        banner_color_end: artist.banner_color_end ?? null,
        ice_color: artist.ice_color ?? null,
        amber_color: artist.amber_color ?? null,
        palette_id: artist.palette_id ?? "spectra",
        visibility: "private",
      })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Couldn't create a network identity." },
        { status: 500, headers }
      );
    }
    profileId = created.id;
  }

  const publishedAt = existing?.published_at ?? new Date().toISOString();
  const { data: profile, error: publishError } = await supabase
    .from("artist_profiles")
    .update({ visibility, published_at: publishedAt })
    .eq("id", profileId)
    .select("*")
    .single();
  if (publishError || !profile) {
    return NextResponse.json(
      { error: publishError?.message ?? "Couldn't join the network." },
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
    console.error("[network/join] Green Room reconciliation pending", error);
  }

  try {
    await connectTeamNetworkFollows(createAdminClient(), user.id);
  } catch (error) {
    console.error("[network/join] team follow connect pending", error);
  }

  return NextResponse.json(profile, { headers });
}
