import { createClient } from "@/lib/supabase/client";
import { deleteFile } from "@/lib/storage";
import type { Conversation, ConversationMessage, MessageAttachment } from "@/lib/types";

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
    .select("conversation_id, last_read_at, left_at, archived_at")
    .eq("user_id", user.id)
    .is("left_at", null);
  participantQuery = archived ? participantQuery.not("archived_at", "is", null) : participantQuery.is("archived_at", null);
  const { data: parts, error } = await participantQuery;
  if (error) throw error;
  if (!parts?.length) return [];

  const ids = parts.map((p) => p.conversation_id);
  const readMap = new Map(parts.map((p) => [p.conversation_id, p.last_read_at]));

  const { data: convos, error: cErr } = await supabase
    .from("conversations")
    .select("*")
    .in("id", ids)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (cErr) throw cErr;

  const { data: allParts } = await supabase
    .from("conversation_participants")
    .select(`conversation_id, profile_id, profile:artist_profiles!conversation_participants_profile_id_fkey(${PEER_SELECT})`)
    .in("conversation_id", ids)
    .is("left_at", null);

  const result: Conversation[] = [];
  for (const c of convos ?? []) {
    const peers = (allParts ?? []).filter(
      (p) => p.conversation_id === c.id && p.profile_id !== myProfileId
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
        .neq("sender_profile_id", myProfileId)
        .gt("created_at", lastRead ?? "1970-01-01");
      unread = count ?? 0;
    }

    result.push({ ...(c as Conversation), peer, unread_count: unread, archived_at: parts.find((part) => part.conversation_id === c.id)?.archived_at ?? null });
  }
  return result;
}

export async function fetchMessages(
  conversationId: string,
  opts?: { before?: string; limit?: number }
): Promise<ConversationMessage[]> {
  const supabase = createClient();
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.before) query = query.lt("created_at", opts.before);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ConversationMessage[]).reverse();
}

export async function sendMessage(input: {
  conversationId: string;
  senderProfileId: string;
  body: string;
  media?: MessageAttachment[];
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
      sender_user_id: user.id,
      body: input.body.trim(),
      media: input.media ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ConversationMessage;
}

export async function deleteMessage(messageOrId: ConversationMessage | string): Promise<void> {
  const supabase = createClient();
  const messageId = typeof messageOrId === "string" ? messageOrId : messageOrId.id;
  const { data: fetchedMessage } = typeof messageOrId === "string"
    ? await supabase.from("messages").select("id, media").eq("id", messageId).maybeSingle()
    : { data: messageOrId };
  const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw error;
  if (fetchedMessage) {
    const typedMessage = fetchedMessage as Pick<ConversationMessage, "id" | "media">;
    await Promise.allSettled((typedMessage.media ?? []).map((item) => deleteFile(typeof item === "string" ? item : item.path)));
  }
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
    .update({ last_read_at: new Date().toISOString() })
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
