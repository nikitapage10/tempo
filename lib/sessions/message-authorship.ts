export function messageAuthorLabel(input: {
  guestName?: string | null;
  profileName?: string | null;
}): string {
  const guest = input.guestName?.trim();
  if (guest) return guest;
  const profile = input.profileName?.trim();
  if (profile) return profile;
  return "Someone";
}

/** A null sender is never "mine", including guest messages on a member client. */
export function isMyMessage(input: {
  senderUserId?: string | null;
  currentUserId?: string | null;
}): boolean {
  if (!input.senderUserId || !input.currentUserId) return false;
  return input.senderUserId === input.currentUserId;
}
