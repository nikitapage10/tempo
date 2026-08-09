/**
 * The version a member must accept before entering the authenticated app.
 * Change this only when a material policy update should require fresh consent.
 */
export const LEGAL_VERSION = "2026-08-08";
export const LEGAL_LAST_UPDATED = "August 8, 2026";

type LegalUser = {
  user_metadata?: Record<string, unknown> | null;
};

export function hasAcceptedCurrentLegalTerms(user: LegalUser | null | undefined) {
  return user?.user_metadata?.legal_terms_version === LEGAL_VERSION;
}
