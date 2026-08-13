/**
 * Who is owed PASSAGE, the team-member counterpart to ORIGIN.
 *
 * The rule, in one place so the app layout, the invite-acceptance page and
 * the /passage route itself cannot drift apart:
 *
 *   - Anyone who joins as a *team member* runs Passage — whether an admin
 *     invited them from the console (member_onboarding.member_role) or an
 *     artist added them to their team (artist_members). Both are people
 *     working in the industry alongside the music, and both deserve the
 *     introduction.
 *   - Track *collaborators* do not. Someone added to comment on one song is
 *     not joining a team, and a film in front of a single track review would
 *     be an imposition rather than a welcome.
 *   - Being onboarded as an artist wins. Origin covers the same ground for a
 *     musician, so an unfinished Origin is never interrupted by Passage — a
 *     dual account does Origin now and Passage never.
 */

export type PassageGateInput = {
  /** member_onboarding.member_role — the durable platform role. */
  platformRole?: string | null;
  /** An active artist_members row: an artist put them on their team. */
  hasTeamMembership: boolean;
  /** member_passages.status. */
  passageStatus?: string | null;
  /** True when the Origin gate is already claiming this person. */
  sendingToOrigin: boolean;
};

export function isTeamMemberAccount(input: {
  platformRole?: string | null;
  hasTeamMembership: boolean;
}): boolean {
  return input.platformRole === "team_member" || input.hasTeamMembership;
}

export function passageFinished(status: string | null | undefined): boolean {
  return status === "complete" || status === "skipped";
}

export function shouldSendToPassage(input: PassageGateInput): boolean {
  // Origin owns the arrival when it is running — never stack two films.
  if (input.sendingToOrigin) return false;
  if (passageFinished(input.passageStatus)) return false;
  return isTeamMemberAccount(input);
}
