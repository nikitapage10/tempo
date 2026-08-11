import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

// artists/{artistId}/{kind}/{filename} — see buildArtistAssetPath.
const ARTIST_SHAPE = /^artists\/([0-9a-f-]{36})\/(emblem|banner)\/[^/]+$/i;
// profiles/{profileId}/posts/{postId}/{filename} — see buildPostMediaPath.
const POST_SHAPE = /^profiles\/([0-9a-f-]{36})\/posts\/([0-9a-f-]{36})\/[^/]+$/i;

/**
 * Storage policies on the `audio` bucket gate on owner = auth.uid(), so a
 * signed-in artist looking at someone else's profile or feed post can't sign
 * those images directly — every read would fall back to the monogram. This
 * route re-checks social visibility server-side and signs on their behalf.
 * Modeled on app/api/scenes/media/url/route.ts.
 *
 * Signed-in only: the unauthenticated /p/[handle] page signs its own images
 * server-side already (lib/public-profile-server.ts).
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });
  }

  const input = await request.json().catch(() => null);
  const path = typeof input?.path === "string" ? input.path : "";
  const artistMatch = path.match(ARTIST_SHAPE);
  const postMatch = path.match(POST_SHAPE);
  if (!artistMatch && !postMatch) {
    return NextResponse.json({ error: "Invalid media request." }, { status: 400, headers });
  }

  const service = createAdminClient();
  let allowed = false;

  if (artistMatch) {
    const [, artistId, kind] = artistMatch;
    // Match the path against the profile row rather than trusting its shape,
    // so a guessed path can never be signed — only imagery the profile is
    // actually presenting as its identity.
    const { data: profile } = await service
      .from("artist_profiles")
      .select("id, emblem_url, banner_url")
      .eq("artist_id", artistId)
      .maybeSingle();
    const presented =
      kind.toLowerCase() === "emblem" ? profile?.emblem_url : profile?.banner_url;
    if (profile && presented === path) {
      // Runs as the caller, so auth.uid() inside the definer function is the
      // signed-in user — visibility ladder and blocks both apply.
      const { data: readable } = await supabase.rpc("profile_is_readable", {
        p_profile_id: profile.id,
      });
      allowed = Boolean(readable);
    }
  } else if (postMatch) {
    const [, profileId, postId] = postMatch;
    const { data: canView } = await supabase.rpc("can_view_post", { p_post_id: postId });
    if (canView) {
      const { data: post } = await service
        .from("posts")
        .select("author_profile_id, media")
        .eq("id", postId)
        .is("deleted_at", null)
        .maybeSingle();
      allowed = Boolean(
        post &&
          post.author_profile_id === profileId &&
          Array.isArray(post.media) &&
          post.media.includes(path)
      );
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "That media isn’t available." }, { status: 404, headers });
  }

  const { data, error } = await service.storage.from("audio").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Couldn’t open this image." }, { status: 500, headers });
  }
  return NextResponse.json({ url: data.signedUrl }, { headers });
}
