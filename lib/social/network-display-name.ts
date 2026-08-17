import {
  isPlaceholderPersonName,
  normalizePersonDisplayName,
} from "@/lib/auth/person-name";

type NetworkDisplayNameInput = {
  requested?: string | null;
  memberProfile?: string | null;
  existingProfile?: string | null;
  artist?: string | null;
  email?: string | null;
};

/**
 * Pick the identity shown to other members before joining creates any social
 * edges. An explicit onboarding answer wins; email-derived placeholders only
 * survive as the final fallback for legacy accounts that supplied no name.
 */
export function resolveNetworkDisplayName(input: NetworkDisplayNameInput): string {
  const candidates = [
    input.requested,
    input.memberProfile,
    input.existingProfile,
    input.artist,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePersonDisplayName(candidate ?? "");
    if (normalized && !isPlaceholderPersonName(normalized, input.email)) {
      return normalized;
    }
  }

  return input.email?.split("@")[0]?.trim().slice(0, 60) || "Member";
}
