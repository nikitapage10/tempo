import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers: HeadersInit = { "Cache-Control": "no-store" };

// scenes/{sceneId}/{kind}/{entityId}/{filename} — see buildSceneMediaPath.
const PATH_SHAPE = /^scenes\/([0-9a-f-]{36})\/(banner|emblem|post)\/[^/]+\/[^/]+$/i;

/**
 * Storage policies on the `audio` bucket gate on owner = auth.uid(), so a
 * member viewing another member's scene banner or post image can't sign a
 * URL directly — this route re-checks visibility server-side and signs on
 * their behalf. Modeled on app/api/messages/attachments/url/route.ts.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers });

  const input = await request.json().catch(() => null);
  const path = typeof input?.path === "string" ? input.path : "";
  const match = path.match(PATH_SHAPE);
  if (!match) {
    return NextResponse.json({ error: "Invalid scene media request." }, { status: 400, headers });
  }
  const [, sceneId, kind] = match;

  // Banner/emblem are part of the scene shell, visible to anyone who can see
  // the scene at all (can_view_scene). Post media is feed content — visible
  // to members only (is_scene_member). Both run as the caller via the server
  // client so auth.uid() inside the definer function is the signed-in user.
  const rpcName = kind === "post" ? "is_scene_member" : "can_view_scene";
  const { data: allowed, error: rpcError } = await supabase.rpc(rpcName, {
    p_scene_id: sceneId,
  });
  if (rpcError || !allowed) {
    return NextResponse.json({ error: "That media isn’t available." }, { status: 404, headers });
  }

  const service = createAdminClient();
  const { data, error } = await service.storage.from("audio").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Couldn’t open this image." }, { status: 500, headers });
  }
  return NextResponse.json({ url: data.signedUrl }, { headers });
}
