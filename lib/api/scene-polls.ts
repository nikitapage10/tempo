import { createClient } from "@/lib/supabase/client";
import { createScenePost } from "@/lib/api/scene-feed";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { Post, ScenePoll, ScenePollOption } from "@/lib/types";

/**
 * A multi-option poll. An open QUESTION is deliberately not built through
 * this path — it's a post with kind='question' and zero options, and
 * answers are ordinary post_comments (see createScenePost). This function is
 * for the case that genuinely needs vote-counted options.
 */
export async function createScenePoll(input: {
  sceneId: string;
  topicId?: string | null;
  authorProfileId: string;
  question: string;
  options: string[];
  multiChoice?: boolean;
  closesAt?: string | null;
  scheduledFor?: string | null;
}): Promise<{ post: Post; poll: ScenePoll }> {
  const cleanOptions = input.options.map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2) {
    throw new Error("A poll needs at least two options.");
  }

  const post = await createScenePost({
    sceneId: input.sceneId,
    topicId: input.topicId,
    authorProfileId: input.authorProfileId,
    body: input.question,
    kind: "poll",
    scheduledFor: input.scheduledFor ?? null,
  });

  const supabase = createClient();
  const { data: poll, error: pollError } = await supabase
    .from("scene_polls")
    .insert({
      post_id: post.id,
      scene_id: input.sceneId,
      kind: "poll",
      multi_choice: input.multiChoice ?? false,
      closes_at: input.closesAt ?? null,
    })
    .select("*")
    .single();
  if (pollError) throw pollError;

  const { error: optionsError } = await supabase.from("scene_poll_options").insert(
    cleanOptions.map((label, i) => ({
      poll_id: poll.id,
      scene_id: input.sceneId,
      label,
      sort_order: i,
    }))
  );
  if (optionsError) throw optionsError;

  return { post, poll: poll as ScenePoll };
}

/** An open question — a post with kind='question', no poll row. */
export async function createSceneQuestion(input: {
  sceneId: string;
  topicId?: string | null;
  authorProfileId: string;
  question: string;
  scheduledFor?: string | null;
}): Promise<Post> {
  return createScenePost({
    sceneId: input.sceneId,
    topicId: input.topicId,
    authorProfileId: input.authorProfileId,
    body: input.question,
    kind: "question",
    scheduledFor: input.scheduledFor ?? null,
  });
}

/** Batch-fetches polls (with options and the caller's own votes) for a set
 *  of post ids — the feed calls this once for every 'poll'-kind post shown. */
export async function fetchScenePollsForPosts(
  postIds: string[],
  myProfileId?: string | null
): Promise<Map<string, ScenePoll>> {
  if (!postIds.length) return new Map();
  const supabase = createClient();

  const { data: polls, error } = await supabase
    .from("scene_polls")
    .select("*")
    .in("post_id", postIds);
  if (error) {
    if (isMissingSceneSchema(error)) return new Map();
    throw error;
  }
  if (!polls?.length) return new Map();

  const pollIds = polls.map((p) => p.id);
  const { data: options } = await supabase
    .from("scene_poll_options")
    .select("*")
    .in("poll_id", pollIds)
    .order("sort_order", { ascending: true });

  let myVotes = new Set<string>();
  if (myProfileId) {
    const { data: votes } = await supabase
      .from("scene_poll_votes")
      .select("option_id, poll_id")
      .eq("profile_id", myProfileId)
      .in("poll_id", pollIds);
    myVotes = new Set((votes ?? []).map((v) => v.option_id as string));
  }

  const optionsByPoll = new Map<string, ScenePollOption[]>();
  for (const o of (options ?? []) as ScenePollOption[]) {
    const list = optionsByPoll.get(o.poll_id) ?? [];
    list.push(o);
    optionsByPoll.set(o.poll_id, list);
  }

  const byPost = new Map<string, ScenePoll>();
  for (const p of polls as ScenePoll[]) {
    const opts = optionsByPoll.get(p.id) ?? [];
    byPost.set(p.post_id, {
      ...p,
      options: opts,
      my_option_ids: opts.filter((o) => myVotes.has(o.id)).map((o) => o.id),
    });
  }
  return byPost;
}

export async function castScenePollVote(
  pollId: string,
  optionIds: string[],
  profileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cast_scene_poll_vote", {
    p_poll_id: pollId,
    p_option_ids: optionIds,
    p_profile_id: profileId,
  });
  if (error) throw error;
}

export async function closeScenePoll(pollId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("close_scene_poll", { p_poll_id: pollId });
  if (error) throw error;
}
