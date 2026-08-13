/**
 * The chips offered on the first PASSAGE step. Deliberately not the same list
 * as lib/team/roles.ts (MemberRole) — those are artist-team permission
 * presets; this is a self-description an invited member gives about who they
 * are in the industry, purely for TEMPO to speak to them correctly. Nothing
 * here changes access.
 */
export const PASSAGE_ROLE_CHIPS = [
  "Manager",
  "Label owner",
  "Collective founder",
  "A&R",
  "Booking agent",
  "Publicist",
  "Tour manager",
  "Assistant",
  "Producer / collaborator",
] as const;

export type PassageRoleChip = (typeof PASSAGE_ROLE_CHIPS)[number];

export const PASSAGE_ROLE_OTHER = "Something else";
