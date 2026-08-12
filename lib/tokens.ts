/**
 * SHA-256 hex digest of a UTF-8 string (Web Crypto). Browser-only — this
 * module is imported by client code (e.g. lib/api/guest-links.ts), so it
 * must stay free of Node built-ins or webpack fails to bundle it for the
 * client. Server route handlers hash tokens with lib/guest-review.ts's
 * `sha256HexServer` instead.
 */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically strong opaque token for guest/invite links. */
export function generateOpaqueToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://mytempo.dev"
  );
}
