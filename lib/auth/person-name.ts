import { DEFAULT_ARTIST_NAME } from "@/lib/constants";

const PLACEHOLDERS = new Set(
  ["home", "your work", "member", "artist name", DEFAULT_ARTIST_NAME].map((n) =>
    n.toLowerCase()
  )
);

/** Trim, collapse spaces, cap length. Null if too short to be a real name. */
export function normalizePersonDisplayName(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length < 2) return null;
  return t.slice(0, 60);
}

/** Personal-home labels that must not appear as "X followed you". */
export function isPlaceholderPersonName(
  name: string | null | undefined,
  email?: string | null
): boolean {
  const t = name?.trim() ?? "";
  if (!t) return true;
  if (PLACEHOLDERS.has(t.toLowerCase())) return true;
  const local = email?.split("@")[0]?.trim().toLowerCase();
  return !!local && t.toLowerCase() === local;
}
