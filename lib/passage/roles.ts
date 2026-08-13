/**
 * The chips offered on the first PASSAGE step.
 *
 * Deliberately not the same list as lib/team/roles.ts (MemberRole) — those are
 * artist-team permission presets. This is a self-description someone gives
 * about who they are in the industry, purely so TEMPO can speak to them
 * correctly. Nothing here changes access.
 *
 * The music industry is not only managers and labels: the people around a
 * record include the ones who shoot it, design it, edit it and put it out.
 * The list stays wide for that reason, and "Something else" is a real answer
 * rather than a fallback.
 */
export const PASSAGE_ROLE_CHIPS = [
  "Manager",
  "Label owner",
  "Collective founder",
  "A&R",
  "Booking agent",
  "Publicist / PR",
  "Tour manager",
  "Creative director",
  "Visual artist / designer",
  "Photographer / videographer",
  "Engineer / producer",
  "Marketing / digital",
  "Publisher",
  "Assistant",
] as const;

export type PassageRoleChip = (typeof PASSAGE_ROLE_CHIPS)[number];

export const PASSAGE_ROLE_OTHER = "Something else";
