import {
  fetchArtistProfile,
  upsertArtistProfile,
} from "@/lib/api/artist-profile";
import type { MemberPassage, PassageStorySection } from "@/lib/passage/types";
import { sanitizePassageInterpretation } from "@/lib/passage/validation";
import type { ArtistProfile, ArtistProfileUpdate } from "@/lib/types";

export type PassageProfileSource = Pick<
  MemberPassage,
  | "displayName"
  | "roleTitles"
  | "roleTitleOther"
  | "entryText"
  | "supportsText"
  | "functionText"
  | "interpretation"
>;

/**
 * A legacy profile needs the one-time handoff only when it predates the
 * completed Passage. Once the profile has been updated afterwards, later
 * edits (including deliberately clearing a field) must win permanently.
 */
export function needsPassageProfileRepair(
  existing: ArtistProfile | null,
  passage: MemberPassage
): boolean {
  if (passage.status !== "complete") return false;
  if (!existing) return true;

  const passageAt = Date.parse(passage.completedAt ?? passage.updatedAt ?? "");
  const profileAt = Date.parse(existing.updated_at ?? "");
  if (!Number.isFinite(passageAt) || !Number.isFinite(profileAt)) return false;
  return profileAt < passageAt;
}

function passageRoles(source: PassageProfileSource): string[] {
  const values = [
    ...source.roleTitles,
    ...(source.roleTitleOther?.trim() ? [source.roleTitleOther.trim()] : []),
  ];
  return Array.from(
    new Set(values.map((role) => role.trim()).filter(Boolean))
  ).slice(0, 8);
}

function answerSections(source: PassageProfileSource): PassageStorySection[] {
  return [
    { title: "Where it started", body: source.entryText?.trim() ?? "" },
    { title: "Who I support", body: source.supportsText?.trim() ?? "" },
    { title: "What I do", body: source.functionText?.trim() ?? "" },
  ].filter((section) => section.body);
}

/**
 * Turn confirmed Passage answers into still-empty professional profile fields.
 * Existing edits, visibility, handle, location, links, and messaging choices
 * are never replaced.
 */
export function passageProfilePatch(
  existing: ArtistProfile | null,
  source: PassageProfileSource
): ArtistProfileUpdate {
  const clean = sanitizePassageInterpretation(source.interpretation);
  const patch: ArtistProfileUpdate = {};

  if (existing?.profile_kind !== "pro") patch.profile_kind = "pro";

  if (!existing?.tagline && clean.headline) {
    patch.tagline = clean.headline.slice(0, 140);
  }
  if (!existing?.bio && clean.intro) patch.bio = clean.intro;

  const roles = passageRoles(source);
  if (!existing?.roles?.length && roles.length) patch.roles = roles;

  const work = source.functionText?.trim() ?? "";
  if (!existing?.current_focus_body && work) patch.current_focus_body = work;

  const story = clean.storySections.length
    ? clean.storySections
    : answerSections(source);
  if (!existing?.story_sections?.length && story.length) {
    patch.story_sections = story;
  }

  return patch;
}

export async function applyPassageToProfile(
  artistId: string,
  source: PassageProfileSource,
  displayName: string
): Promise<ArtistProfile | null> {
  const existing = await fetchArtistProfile(artistId);
  const patch = passageProfilePatch(existing, source);
  if (Object.keys(patch).length === 0) return existing;

  return upsertArtistProfile(
    artistId,
    patch,
    existing?.display_name || source.displayName?.trim() || displayName
  );
}
