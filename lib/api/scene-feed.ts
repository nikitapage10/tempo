import { createClient } from "@/lib/supabase/client";
import { extractHandles } from "@/lib/api/feed";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { Post, ScenePostKind } from "@/lib/types";

const AUTHOR_SELECT =
  "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color";

function mapPost(row: Record<string, unknown>, likedIds?: Set<string>): Post {
  const media = Array.isArray(row.media) ? (row.media as string[]) : [];
  return {
    ...(row as unknown as Post),
    media,
    author: (row.author as Post["author"]) ?? null,
    liked_by_me: likedIds ? likedIds.has(row.id as string) : undefined,
  };
}

async function hydrateAuthorsAndLikes(
  rows: Record<string, unknown>[],
  myProfileId?: string | null
): Promise<Post[]> {
  if (!rows.length) return [];
  const supabase = createClient();

  const authorIds: string[] = [];
  for (const r of rows) {
    const id = r.author_profile_id as string;
    if (!authorIds.includes(id)) authorIds.push(id);
  }
  const { data: authors } = await supabase
    .from("artist_profiles")
    .select(AUTHOR_SELECT)
    .in("id", authorIds);
  const byId = new Map((authors ?? []).map((a) => [a.id, a]));

  let liked = new Set<string>();
  if (myProfileId) {
    const { data } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("profile_id", myProfileId)
      .in(
        "post_id",
        rows.map((r) => r.id as string)
      );
    liked = new Set((data ?? []).map((r) => r.post_id));
  }

  return rows.map((r) =>
    mapPost({ ...r, author: byId.get(r.author_profile_id as string) ?? null }, liked)
  );
}

/** A scene's forum feed, oldest-pinned-first-then-chronological via the
 *  scene_feed() RPC (security invoker — posts RLS still applies). */
export async function fetchSceneFeed(
  sceneId: string,
  opts: { topicId?: string | null; sectionId?: string | null; limit?: number; before?: string; myProfileId?: string | null } = {}
): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("scene_feed", {
    p_scene_id: sceneId,
    p_topic_id: opts.topicId ?? null,
    p_limit: opts.limit ?? 30,
    p_before: opts.before ?? null,
  });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => !opts.sectionId || row.scene_section_id === opts.sectionId);
  return hydrateAuthorsAndLikes(rows, opts.myProfileId);
}

export async function fetchScenePinnedPosts(
  sceneId: string,
  myProfileId?: string | null
): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("scene_id", sceneId)
    .is("deleted_at", null)
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return hydrateAuthorsAndLikes((data ?? []) as Record<string, unknown>[], myProfileId);
}

export async function createScenePost(input: {
  sceneId: string;
  topicId?: string | null;
  sectionId?: string | null;
  authorProfileId: string;
  body: string;
  media?: string[];
  trackId?: string | null;
  kind?: ScenePostKind;
  scheduledFor?: string | null;
}): Promise<Post> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_profile_id: input.authorProfileId,
      author_user_id: user.id,
      body: input.body.trim(),
      media: input.media ?? [],
      track_id: input.trackId ?? null,
      visibility: "members",
      scene_id: input.sceneId,
      scene_topic_id: input.topicId ?? null,
      scene_section_id: input.sectionId ?? null,
      kind: input.kind ?? "post",
      scheduled_for: input.scheduledFor ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const handles = extractHandles(input.body);
  if (handles.length) {
    const { data: mentioned } = await supabase
      .from("artist_profiles")
      .select("id, handle")
      .in("handle", handles);
    if (mentioned?.length) {
      await supabase.from("post_mentions").insert(
        mentioned.map((m) => ({ post_id: data.id, mentioned_profile_id: m.id }))
      );
    }
  }

  return mapPost(data as unknown as Record<string, unknown>, new Set());
}

export async function setScenePostPinned(postId: string, pinned: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_scene_post_pinned", {
    p_post_id: postId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function removeScenePost(postId: string, note?: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("scene_remove_post", {
    p_post_id: postId,
    p_note: note ?? null,
  });
  if (error) throw error;
}
