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
