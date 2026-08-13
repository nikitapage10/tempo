import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminsOfArtistInviteRequest } from "@/lib/admin/invite-activity";

export const dynamic = "force-dynamic";

function missingTable(message: string): boolean {
  return /schema cache|does not exist|artist_invite_requests/i.test(message);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Add a valid email." }, { status: 400 });
  }
  const note =
    typeof body?.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;
  let trackId =
    typeof body?.trackId === "string" && body.trackId ? body.trackId : null;
  let artistId =
    typeof body?.artistId === "string" && body.artistId ? body.artistId : null;

  if (trackId) {
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("id, user_id, space_id")
      .eq("id", trackId)
      .maybeSingle();
    if (trackError || !track) {
      return Response.json(
        { error: "You can only request an artist invite from a track you own." },
        { status: 403 }
      );
    }
    const { data: space } = track.space_id
      ? await supabase
          .from("spaces")
          .select("artist_id")
          .eq("id", track.space_id)
          .maybeSingle()
      : { data: null };
    artistId = space?.artist_id ?? artistId;
    let artistOwnerId: string | null = null;
    if (space?.artist_id) {
      const { data: artist } = await supabase
        .from("artists")
        .select("id, user_id")
        .eq("id", space.artist_id)
        .maybeSingle();
      artistOwnerId = artist?.user_id ?? null;
    }
    if (track.user_id !== user.id && artistOwnerId !== user.id) {
      return Response.json(
        { error: "You can only request an artist invite from a track you own." },
        { status: 403 }
      );
    }
  } else if (artistId) {
    const { data: artist } = await supabase
      .from("artists")
      .select("id, user_id")
      .eq("id", artistId)
      .maybeSingle();
    if (!artist || artist.user_id !== user.id) {
      return Response.json(
        { error: "You can only request an artist invite from an artist you own." },
        { status: 403 }
      );
    }
  }

  const { data: member } = await supabase
    .from("artist_member_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: ownedArtist } = await supabase
    .from("artists")
    .select("name")
    .eq("user_id", user.id)
    .neq("workspace_kind", "personal")
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();
  const requestedByName =
    (typeof member?.display_name === "string" && member.display_name.trim()) ||
    ownedArtist?.name ||
    user.email?.split("@")[0] ||
    "A TEMPO member";

  const { data, error } = await supabase
    .from("artist_invite_requests")
    .insert({
      requested_by: user.id,
      email,
      note,
      track_id: trackId,
      artist_id: artistId,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) {
    const message = error?.message ?? "Couldn’t send that invite request.";
    if (missingTable(message)) {
      return Response.json(
        {
          error:
            "Artist invite requests aren’t set up yet — run migration 093 in Supabase, then try again.",
        },
        { status: 503 }
      );
    }
    if (/artist_invite_requests_pending_email|duplicate/i.test(message)) {
      return Response.json(
        { error: "That email already has a pending artist invite request." },
        { status: 409 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }

  try {
    await notifyAdminsOfArtistInviteRequest({
      service: createAdminClient(),
      requestId: data.id,
      email,
      requestedByName,
    });
  } catch (err) {
    console.error("[artist-invite-requests] notify", err);
  }

  return Response.json({ id: data.id }, { status: 201 });
}
