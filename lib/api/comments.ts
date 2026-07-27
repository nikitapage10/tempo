import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/api/activity";
import { notify } from "@/lib/api/notify";
import type { Comment } from "@/lib/types";

/** version_id filter, or "all" to fetch every comment on the track. */
export type VersionFilter = string | "all";

export async function fetchComments(
  trackId: string,
  versionId: VersionFilter = "all"
): Promise<Comment[]> {
  const supabase = createClient();
  let query = supabase.from("comments").select("*").eq("track_id", trackId);
  if (versionId !== "all") {
    query = query.eq("version_id", versionId);
  }
  const { data, error } = await query
    .order("timestamp_sec", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateCommentInput = {
  trackId: string;
  versionId: string;
  text: string;
  timestampSec?: number | null;
  parentId?: string | null;
  assignedToUserId?: string | null;
  guestName?: string | null;
  guestLinkId?: string | null;
};

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      track_id: input.trackId,
      version_id: input.versionId,
      text: input.text.trim(),
      timestamp_sec: input.timestampSec ?? null,
      parent_id: input.parentId ?? null,
      assigned_to_user_id: input.assignedToUserId ?? null,
      author_user_id: input.guestLinkId ? null : userData.user?.id ?? null,
      guest_name: input.guestName ?? null,
      guest_link_id: input.guestLinkId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  void afterCreateComment(data, userData.user?.email ?? null);

  return data;
}

/** Best-effort activity log + reply/assignment notifications after a comment lands. */
async function afterCreateComment(
  comment: Comment,
  actorLabel: string | null
): Promise<void> {
  try {
    const who = actorLabel ?? comment.guest_name ?? "Someone";
    await logActivity({
      trackId: comment.track_id,
      eventType: comment.parent_id ? "comment_replied" : "comment_added",
      summary: comment.timestamp_sec != null
        ? `${who} commented at ${Math.floor(comment.timestamp_sec)}s`
        : `${who} commented`,
      entityType: "comment",
      entityId: comment.id,
      actorLabel: who,
    });

    if (comment.parent_id) {
      const supabase = createClient();
      const { data: parent } = await supabase
        .from("comments")
        .select("author_user_id")
        .eq("id", comment.parent_id)
        .maybeSingle();
      if (parent?.author_user_id) {
        await notify({
          trackId: comment.track_id,
          type: "comment_reply",
          title: `${who} replied to your comment`,
          body: comment.text.slice(0, 140),
          targetUserId: parent.author_user_id,
        });
      }
    }

    if (comment.assigned_to_user_id) {
      await notify({
        trackId: comment.track_id,
        type: "comment_assigned",
        title: `${who} assigned you a comment`,
        body: comment.text.slice(0, 140),
        targetUserId: comment.assigned_to_user_id,
      });
    }
  } catch {
    /* best-effort */
  }
}

export type UpdateCommentInput = {
  text?: string;
  assignedToUserId?: string | null;
};

export async function updateComment(
  id: string,
  patch: UpdateCommentInput
): Promise<Comment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({
      ...(patch.text !== undefined ? { text: patch.text.trim() } : {}),
      ...(patch.assignedToUserId !== undefined
        ? { assigned_to_user_id: patch.assignedToUserId }
        : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  if (patch.assignedToUserId) {
    const { data: userData } = await supabase.auth.getUser();
    void notify({
      trackId: data.track_id,
      type: "comment_assigned",
      title: `${userData.user?.email ?? "Someone"} assigned you a comment`,
      body: data.text.slice(0, 140),
      targetUserId: patch.assignedToUserId,
    });
  }

  return data;
}

export async function resolveComment(id: string): Promise<Comment> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("comments")
    .update({
      resolved: true,
      resolved_by_user_id: userData.user?.id ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reopenComment(id: string): Promise<Comment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ resolved: false })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

/** Total comments (any state) on one version — used by the delete-version confirm copy. */
export async function countCommentsForVersion(versionId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("version_id", versionId);
  if (error) throw error;
  return count ?? 0;
}

/** Unresolved top-level comment threads on a track (mirrors track_unresolved_comment_counts). */
export async function countUnresolved(trackId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackId)
    .eq("resolved", false)
    .is("parent_id", null);
  if (error) throw error;
  return count ?? 0;
}
