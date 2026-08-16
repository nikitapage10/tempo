import { createClient } from "@/lib/supabase/client";
import { deleteFile } from "@/lib/storage";
import type { Conversation, ConversationMessage, MessageAttachment } from "@/lib/types";

export type MessageCursor = { createdAt: string; id: string };

type MessageReplyRow = Pick<
  ConversationMessage,
  "id" | "body" | "deleted_at" | "sender_profile_id" | "sender_scene_persona_id"
>;

const PEER_SELECT =
  "id, handle, display_name, emblem_url, palette_id, ice_color, amber_color";

export async function startDirectConversation(
  fromProfileId: string,
  toProfileId: string
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_direct_conversation", {
    p_from_profile: fromProfileId,
    p_to_profile: toProfileId,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchConversations(
  myProfileId: string,
  archived = false,
): Promise<Conversation[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let participantQuery = supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, left_at, archived_at, muted, manually_unread_at")
    .eq("user_id", user.id)
    .is("left_at", null);
  participantQuery = archived
    ? participantQuery
        .not("archived_at", "is", null)
        // Automated Nikita welcomes use PostgreSQL's infinity timestamp as a
        // hidden-until-reply sentinel, not as a user-visible archive state.
        .neq("archived_at", "infinity")
    : participantQuery.is("archived_at", null);
  const { data: parts, error } = await participantQuery;
  if (error) throw error;
  if (!parts?.length) return [];

  const ids = parts.map((p) => p.conversation_id);
  const readMap = new Map(parts.map((p) => [p.conversation_id, p.last_read_at]));

  const { data: roomRows } = await supabase
    .from("artist_team_rooms")
    .select("artist_id, conversation_id")
    .in("conversation_id", ids);
  const roomByConversation = new Map((roomRows ?? []).map((row) => [row.conversation_id, row.artist_id]));

  const { data: allConvos, error: cErr } = await supabase
    .from("conversations")
    .select("*")
    // Scene rooms are 'group' conversations too (migration 053), but this
    // inbox's `peer` model assumes exactly one other participant — a scene
    // room is reached from its own Chat tab instead, not this list.
    .in("id", ids)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (cErr) throw cErr;
  const convos = (allConvos ?? []).filter(
    (conversation) => conversation.kind === "direct" || roomByConversation.has(conversation.id)
  );

  const { data: allParts } = await supabase
    .from("conversation_participants")
    .select(`conversation_id, profile_id, user_id, profile:artist_profiles!conversation_participants_profile_id_fkey(${PEER_SELECT})`)
    .in("conversation_id", ids)
    .is("left_at", null);

  const result: Conversation[] = [];
  for (const c of convos ?? []) {
    const peers = (allParts ?? []).filter(
      // The inbox belongs to the signed-in account, not whichever artist or
      // Pro workspace happens to be open. A thread may have been provisioned
      // against another profile owned by this same account, so profile-based
      // comparison can mistake the member's own artist for the other person.
      (p) => p.conversation_id === c.id && p.user_id !== user.id
    );
    const peerRaw = peers[0]?.profile as unknown;
    const peer = (
      Array.isArray(peerRaw) ? peerRaw[0] : peerRaw
    ) as Conversation["peer"];

    const lastRead = readMap.get(c.id);
    let unread = 0;
    if (c.last_message_at && (!lastRead || c.last_message_at > lastRead)) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .is("deleted_at", null)
        .neq("sender_user_id", user.id)
        .gt("created_at", lastRead ?? "1970-01-01");
      unread = count ?? 0;
    }

    const participant = parts.find((part) => part.conversation_id === c.id);
    const manuallyUnread = participant?.manually_unread_at ?? null;
    result.push({
      ...(c as Conversation),
      peer,
      unread_count: manuallyUnread ? Math.max(1, unread) : unread,
      archived_at: participant?.archived_at ?? null,
      muted: Boolean(participant?.muted),
      manually_unread_at: manuallyUnread,
      team_artist_id: roomByConversation.get(c.id) ?? null,
    });
  }
  return result;
}

async function enrichMessages(
  conversationId: string,
  rows: ConversationMessage[],
): Promise<ConversationMessage[]> {
  if (!rows.length) return rows;
  const supabase = createClient();
  const ids = rows.map((message) => message.id);
  const replyIds = Array.from(new Set(rows.map((message) => message.reply_to_message_id).filter((id): id is string => !!id)));
  const [{ data: directReactions }, { data: sceneReactions }, { data: pins }, { data: replies }, { data: auth }] = await Promise.all([
    supabase.from("direct_message_reactions").select("message_id, user_id, emoji").in("message_id", ids),
    supabase.from("scene_message_reactions").select("message_id, persona_id, emoji").in("message_id", ids),
    supabase.from("conversation_message_pins").select("message_id").eq("conversation_id", conversationId).in("message_id", ids),
    replyIds.length
      ? supabase.from("messages").select("id, body, deleted_at, sender_profile_id, sender_scene_persona_id").in("id", replyIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.auth.getUser(),
  ]);
  const userId = auth.user?.id ?? null;
  let myPersonaId: string | null = null;
  if (userId && sceneReactions?.length) {
    const { data } = await supabase
      .from("conversation_participants")
      .select("scene_persona_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    myPersonaId = data?.scene_persona_id ?? null;
  }
  const replyRows = (replies ?? []) as MessageReplyRow[];
  const replyMap = new Map(replyRows.map((reply) => [reply.id, reply]));
  const pinned = new Set((pins ?? []).map((pin) => pin.message_id));

  return rows.map((message) => {
    const reactionMap = new Map<string, { count: number; reacted_by_me: boolean }>();
    for (const reaction of directReactions ?? []) {
      if (reaction.message_id !== message.id) continue;
      const current = reactionMap.get(reaction.emoji) ?? { count: 0, reacted_by_me: false };
      current.count += 1;
      current.reacted_by_me ||= reaction.user_id === userId;
      reactionMap.set(reaction.emoji, current);
    }
    for (const reaction of sceneReactions ?? []) {
      if (reaction.message_id !== message.id) continue;
      const current = reactionMap.get(reaction.emoji) ?? { count: 0, reacted_by_me: false };
      current.count += 1;
      current.reacted_by_me ||= reaction.persona_id === myPersonaId;
      reactionMap.set(reaction.emoji, current);
    }
    const reply = message.reply_to_message_id ? replyMap.get(message.reply_to_message_id) : null;
    return {
      ...message,
      pinned: pinned.has(message.id),
      reactions: Array.from(reactionMap, ([emoji, value]) => ({ emoji, ...value })),
      reply_preview: reply
        ? {
            id: reply.id,
            body: reply.deleted_at ? "" : reply.body,
            deleted: Boolean(reply.deleted_at),
            sender_profile_id: reply.sender_profile_id,
            sender_scene_persona_id: reply.sender_scene_persona_id,
          }
        : message.reply_to_message_id
          ? { id: message.reply_to_message_id, body: "", deleted: true, sender_profile_id: null }
          : null,
    };
  });
}

export async function fetchMessages(
  conversationId: string,
  opts?: { before?: MessageCursor; limit?: number }
): Promise<ConversationMessage[]> {
  const supabase = createClient();
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.before) {
    query = query.or(
      `created_at.lt.${opts.before.createdAt},and(created_at.eq.${opts.before.createdAt},id.lt.${opts.before.id})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return enrichMessages(conversationId, ((data ?? []) as ConversationMessage[]).reverse());
}

export async function sendMessage(input: {
  conversationId: string;
    senderProfileId: string | null;
    senderScenePersonaId?: string | null;
  body: string;
  media?: MessageAttachment[];
  replyToMessageId?: string | null;
}): Promise<ConversationMessage> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
        sender_profile_id: input.senderProfileId,
        sender_scene_persona_id: input.senderScenePersonaId ?? null,
      sender_user_id: user.id,
      body: input.body.trim(),
      media: input.media ?? [],
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ConversationMessage;
}

export async function deleteMessage(messageOrId: ConversationMessage | string): Promise<void> {
  const supabase = createClient();
  const messageId = typeof messageOrId === "string" ? messageOrId : messageOrId.id;
  const { data, error } = await supabase.rpc("delete_message", { p_message_id: messageId });
  if (error) throw error;
  const media = (Array.isArray(data) ? data : []) as (string | MessageAttachment)[];
  await Promise.allSettled(media.map((item) => deleteFile(typeof item === "string" ? item : item.path)));
}

export async function editMessage(messageId: string, body: string): Promise<ConversationMessage> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("edit_message", { p_message_id: messageId, p_body: body });
  if (error) throw error;
  return data as ConversationMessage;
}

export async function searchConversationMessages(conversationId: string, query: string): Promise<ConversationMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_conversation_messages", {
    p_conversation_id: conversationId,
    p_query: query,
    p_limit: 100,
  });
  if (error) throw error;
  return enrichMessages(conversationId, (data ?? []) as ConversationMessage[]);
}

export async function toggleMessageReaction(input: { messageId: string; profileId: string; emoji: string }): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("toggle_direct_message_reaction", {
    p_message_id: input.messageId,
    p_profile_id: input.profileId,
    p_emoji: input.emoji,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function toggleSceneMessageReaction(input: { messageId: string; sceneId: string; personaId: string; emoji: string }): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.from("scene_message_reactions").select("message_id").eq("message_id", input.messageId).eq("persona_id", input.personaId).eq("emoji", input.emoji).maybeSingle();
  const result = data
    ? await supabase.from("scene_message_reactions").delete().eq("message_id", input.messageId).eq("persona_id", input.personaId).eq("emoji", input.emoji)
    : await supabase.from("scene_message_reactions").insert({ message_id: input.messageId, scene_id: input.sceneId, persona_id: input.personaId, emoji: input.emoji });
  if (result.error) throw result.error;
}

export async function toggleMessagePin(messageId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("toggle_conversation_message_pin", { p_message_id: messageId });
  if (error) throw error;
  return Boolean(data);
}

export async function setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_conversation_muted", { p_conversation_id: conversationId, p_muted: muted });
  if (error) throw error;
}

export async function markConversationUnread(conversationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_conversation_unread", { p_conversation_id: conversationId });
  if (error) throw error;
}

export async function setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Signed out");
  const { error } = await supabase.from("conversation_participants").update({ archived_at: archived ? new Date().toISOString() : null }).eq("conversation_id", conversationId).eq("user_id", user.id);
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString(), manually_unread_at: null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function fetchUnreadDmCount(myProfileId: string): Promise<number> {
  const convos = await fetchConversations(myProfileId);
  return convos.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
}

export async function canDmProfile(targetProfileId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("can_dm_profile", {
    p_target_profile_id: targetProfileId,
  });
  if (error) throw error;
  return !!data;
}
