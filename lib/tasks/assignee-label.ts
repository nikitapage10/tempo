import {
  isPlaceholderPersonName,
  normalizePersonDisplayName,
} from "@/lib/auth/person-name";

export type TaskAssigneeOption = { userId: string; label: string };

/** First real person name in the list; never a role like "Artist owner". */
export function taskPersonLabel(
  candidates: Array<string | null | undefined>,
  fallback: string,
  email?: string | null
): string {
  for (const raw of candidates) {
    const name = normalizePersonDisplayName(raw ?? "");
    if (name && !isPlaceholderPersonName(name, email)) return name;
  }
  return fallback;
}

/**
 * Owner of this workspace first (artist or Pro home), then you if that isn't
 * already you, then eligible teammates. Labels are names.
 */
export function buildTaskAssigneeOptions(input: {
  currentUserId: string | null;
  currentUserEmail: string | null;
  currentUserName: string | null;
  ownerUserId: string | null;
  ownerWorkspaceName: string | null;
  memberNames: Map<string, string | null | undefined>;
  eligibleUserIds: string[];
}): TaskAssigneeOption[] {
  const seen = new Set<string>();
  const out: TaskAssigneeOption[] = [];

  const nameOf = (userId: string | null) =>
    userId ? (input.memberNames.get(userId) ?? null) : null;

  const add = (
    userId: string | null,
    candidates: Array<string | null | undefined>,
    fallback: string
  ) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    const email =
      userId === input.currentUserId ? input.currentUserEmail : null;
    out.push({
      userId,
      label: taskPersonLabel(candidates, fallback, email),
    });
  };

  add(
    input.ownerUserId,
    [
      input.ownerUserId === input.currentUserId ? input.currentUserName : null,
      nameOf(input.ownerUserId),
      input.ownerWorkspaceName,
    ],
    input.ownerUserId === input.currentUserId ? "You" : "Artist"
  );

  add(
    input.currentUserId,
    [
      input.currentUserName,
      nameOf(input.currentUserId),
      input.ownerWorkspaceName,
    ],
    "You"
  );

  for (const userId of input.eligibleUserIds) {
    add(userId, [nameOf(userId)], "Team member");
  }

  return out;
}
