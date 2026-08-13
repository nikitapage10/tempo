/**
 * Shared helpers for the invite → sign-in / create-account path.
 * Safe to import from client components — no secrets, no admin client.
 */

export type InviteSignupKind = "team" | "track";

export type InviteSignupRef = {
  kind: InviteSignupKind;
  token: string;
};

const TEAM_REDIRECT = /^\/team-invite\/([^/?#]+)$/;
const TRACK_REDIRECT = /^\/invite\/([^/?#]+)$/;

export function isSafeRedirect(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

/** Pull a team or track invite token out of a post-auth redirect path. */
export function parseInviteRedirect(redirect: string | null): InviteSignupRef | null {
  if (!isSafeRedirect(redirect)) return null;
  const team = redirect.match(TEAM_REDIRECT);
  if (team?.[1]) return { kind: "team", token: decodeURIComponent(team[1]) };
  const track = redirect.match(TRACK_REDIRECT);
  if (track?.[1]) return { kind: "track", token: decodeURIComponent(track[1]) };
  return null;
}

export function inviteLoginHref(redirectPath: string, email?: string): string {
  const params = new URLSearchParams();
  params.set("redirect", redirectPath);
  if (email?.trim()) params.set("email", email.trim());
  return `/login?${params.toString()}`;
}

export function inviteRegisterHref(redirectPath: string): string {
  return `/register?redirect=${encodeURIComponent(redirectPath)}`;
}

/** Artist-program invite: sign in on an existing account, then redeem. */
export function platformInviteLoginHref(code: string, email?: string): string {
  const params = new URLSearchParams();
  params.set("invite", code);
  if (email?.trim()) params.set("email", email.trim());
  return `/login?${params.toString()}`;
}

/** After a signed-in redeem, Origin starts from the welcome chooser. */
export function platformInviteWelcomeHref(code: string): string {
  return `/welcome?invite=${encodeURIComponent(code)}`;
}
