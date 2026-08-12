/** Surfaces where an incoming DM should not raise a glass toast. */

export function isMessagesSurface(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/messages" || pathname.startsWith("/messages/");
}
