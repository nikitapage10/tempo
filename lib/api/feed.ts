import { createClient } from "@/lib/supabase/client";
import type { Post, PostComment, PostVisibility } from "@/lib/types";

const AUTHOR_SELECT =
  "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color";

export function extractHandles(text: string): string[] {
  const handles: string[] = [];
  const re = /@([a-z0-9_.]{3,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const h = m[1].toLowerCase();
    if (!handles.includes(h)) handles.push(h);
  }
  return handles;
}

function mapPost(row: Record<string, unknown>, likedIds?: Set<string>): Post {
  const media = Array.isArray(row.media) ? (row.media as string[]) : [];
  return {
    ...(row as unknown as Post),
    media,
    author: (row.author as Post["author"]) ?? null,
    liked_by_me: likedIds ? likedIds.has(row.id as string) : undefined,
  };
}

async function likedPostIds(postIds: string[], profileId: string): Promise<Set<string>> {
  if (!postIds.length) return new Set();
  const supabase = createClient();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("profile_id", profileId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((r) => r.post_id));
}

export async function fetchHomeTimeline(opts?: {
  limit?: number;
  before?: string;
  myProfileId?: string;
}): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("home_timeline", {
    p_limit: opts?.limit ?? 30,
    p_before: opts?.before ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return [];

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

  const liked = opts?.myProfileId
    ? await likedPostIds(
        rows.map((r) => r.id as string),
        opts.myProfileId
      )
    : new Set<string>();

  return rows.map((r) =>
    mapPost({ ...r, author: byId.get(r.author_profile_id as string) ?? null }, liked)
  );
}

export async function fetchPost(
  postId: string,
  myProfileId?: string
): Promise<Post | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:artist_profiles!posts_author_profile_id_fkey(id, handle, display_name, emblem_url, palette_id, ice_color, amber_color)")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const liked = myProfileId
    ? await likedPostIds([postId], myProfileId)
    : new Set<string>();
  return mapPost(data as unknown as Record<string, unknown>, liked);
}

export async function createPost(input: {
  authorProfileId: string;
  body: string;
  media?: string[];
  trackId?: string | null;
  visibility?: PostVisibility;
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
      visibility: input.visibility ?? "followers",
    })
    .select("*, author:artist_profiles!posts_author_profile_id_fkey(id, handle, display_name, emblem_url, palette_id, ice_color, amber_color)")
    .single();
  if (error) throw error;

  // Resolve @handles into post_mentions
  const handles = extractHandles(input.body);
  if (handles.length) {
    const { data: mentioned } = await supabase
      .from("artist_profiles")
      .select("id, handle")
      .in("handle", handles);
    if (mentioned?.length) {
      await supabase.from("post_mentions").insert(
        mentioned.map((m) => ({
          post_id: data.id,
          mentioned_profile_id: m.id,
        }))
      );
    }
  }

  return mapPost(data as unknown as Record<string, unknown>, new Set());
}

export async function softDeletePost(postId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
}

export async function likePost(postId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");
  const { error } = await supabase.from("post_likes").insert({
    post_id: postId,
    profile_id: profileId,
    user_id: user.id,
  });
  if (error) throw error;
}

export async function unlikePost(postId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      `*, author:artist_profiles!post_comments_author_profile_id_fkey(id, handle, display_name, emblem_url, palette_id)`
    )
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PostComment[];
}

export async function createPostComment(input: {
  postId: string;
  authorProfileId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<PostComment> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: input.postId,
      author_profile_id: input.authorProfileId,
      author_user_id: user.id,
      body: input.body.trim(),
      parent_comment_id: input.parentCommentId ?? null,
    })
    .select(
      `*, author:artist_profiles!post_comments_author_profile_id_fkey(id, handle, display_name, emblem_url, palette_id)`
    )
    .single();
  if (error) throw error;

  const handles = extractHandles(input.body);
  if (handles.length) {
    const { data: mentioned } = await supabase
      .from("artist_profiles")
      .select("id")
      .in("handle", handles);
    if (mentioned?.length) {
      await supabase.from("post_mentions").insert(
        mentioned.map((m) => ({
          comment_id: data.id,
          mentioned_profile_id: m.id,
        }))
      );
    }
  }

  return data as PostComment;
}
