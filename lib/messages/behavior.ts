export const TYPING_TTL_MS = 5_000;

export function shouldAutoFollowConversation(input: { nearBottom: boolean; sentByMe: boolean }): boolean {
  return input.nearBottom || input.sentByMe;
}

export function isNearConversationBottom(input: { scrollHeight: number; scrollTop: number; clientHeight: number; threshold?: number }): boolean {
  return input.scrollHeight - input.scrollTop - input.clientHeight <= (input.threshold ?? 96);
}

export function messageDraftStorageKey(key: string): string {
  return `tempo:message-draft:${key}`;
}

export function typingExpiry(now = Date.now()): number {
  return now + TYPING_TTL_MS;
}

export function preservedScrollTop(input: { beforeHeight: number; beforeTop: number; afterHeight: number }): number {
  return input.beforeTop + Math.max(0, input.afterHeight - input.beforeHeight);
}

export function resolvePreferredAudioInput(preferredId: string | null, availableIds: string[]): string | null {
  return preferredId && availableIds.includes(preferredId) ? preferredId : null;
}

/** Inbox rows: 1:1 threads, team rooms, and artist groups — never Scene rooms. */
export function isMessagesInboxConversation(input: {
  kind: string;
  sceneId?: string | null;
  isTeamRoom: boolean;
}): boolean {
  if (input.kind === "direct" || input.isTeamRoom) return true;
  return input.kind === "group" && !input.sceneId;
}

export function isArtistGroupConversation(input: {
  kind: string;
  teamArtistId?: string | null;
}): boolean {
  return input.kind === "group" && !input.teamArtistId;
}

export function suggestedGroupTitle(names: string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (!cleaned.length) return "Group chat";
  if (cleaned.length <= 3) return cleaned.join(", ");
  return `${cleaned.slice(0, 2).join(", ")} +${cleaned.length - 2}`;
}

export function conversationHeading(input: {
  kind: string;
  title?: string | null;
  teamArtistId?: string | null;
  peerName?: string | null;
}): string {
  if (input.teamArtistId) return input.title?.trim() || "Artist team";
  if (input.kind === "group") return input.title?.trim() || "Group chat";
  return input.peerName?.trim() || "Conversation";
}

export function conversationMemberLabel(names: string[], max = 3): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (!cleaned.length) return "Group chat";
  if (cleaned.length <= max) return cleaned.join(", ");
  return `${cleaned.slice(0, max).join(", ")} +${cleaned.length - max}`;
}
