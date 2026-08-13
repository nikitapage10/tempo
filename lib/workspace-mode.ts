import type { Artist } from "@/lib/types";
import { canRead, type AreaGrants, type AreaKey } from "@/lib/team/areas";

export type WorkspaceKind = "artist" | "personal";
export type WorkspaceMode = "artist" | "work" | "entered";

export function artistWorkspaceKind(
  artist: Pick<Artist, "workspace_kind"> | null | undefined
): WorkspaceKind {
  return artist?.workspace_kind === "personal" ? "personal" : "artist";
}

export function isOwnedWorkspace(
  artist: Pick<Artist, "user_id"> | null | undefined,
  userId: string | null | undefined
): boolean {
  return !!artist && !!userId && artist.user_id === userId;
}

/** What shell the signed-in person is in for the currently active artist row. */
export function resolveWorkspaceMode(
  artist: Artist | null | undefined,
  userId: string | null | undefined
): WorkspaceMode {
  if (!artist || !userId) return "work";
  if (artist.user_id !== userId) return "entered";
  return artistWorkspaceKind(artist) === "personal" ? "work" : "artist";
}

export function ownedPersonalWorkspace(
  artists: Artist[],
  userId: string | null | undefined
): Artist | null {
  if (!userId) return null;
  return (
    artists.find(
      (a) => a.user_id === userId && artistWorkspaceKind(a) === "personal"
    ) ?? null
  );
}

export function ownedMusicArtists(
  artists: Artist[],
  userId: string | null | undefined
): Artist[] {
  if (!userId) return [];
  return artists.filter(
    (a) => a.user_id === userId && artistWorkspaceKind(a) === "artist"
  );
}

export function membershipArtists(
  artists: Artist[],
  userId: string | null | undefined
): Artist[] {
  if (!userId) return [];
  return artists.filter((a) => a.user_id !== userId);
}

/**
 * Team-only (and dual) accounts should wake up in their own work home, not
 * inside the first membership-visible artist. Solo artists are unchanged.
 */
export function pickDefaultArtistId(
  artists: Artist[],
  userId: string | null | undefined
): string | null {
  if (artists.length === 0) return null;
  const personal = ownedPersonalWorkspace(artists, userId);
  const music = ownedMusicArtists(artists, userId)[0] ?? null;
  const hasMembership = membershipArtists(artists, userId).length > 0;
  if (hasMembership && personal) return personal.id;
  if (music) return music.id;
  if (personal) return personal.id;
  return artists[0]?.id ?? null;
}

/**
 * Feed composer identity: post as the music artist in My artist, otherwise
 * as the personal workspace — never as a managed artist.
 */
export function socialAuthorArtistId(
  artists: Artist[],
  activeArtist: Artist | null | undefined,
  userId: string | null | undefined
): string | null {
  const mode = resolveWorkspaceMode(activeArtist, userId);
  if (mode === "artist") return activeArtist?.id ?? null;
  const personal = ownedPersonalWorkspace(artists, userId);
  if (personal) return personal.id;
  const owned = artists.find((a) => a.user_id === userId);
  return owned?.id ?? null;
}

const AREA_BY_PATH: { prefix: string; area: AreaKey | "tasks" }[] = [
  { prefix: "/board", area: "catalog" },
  { prefix: "/tracks", area: "catalog" },
  { prefix: "/track/", area: "catalog" },
  { prefix: "/projects", area: "catalog" },
  { prefix: "/tasks", area: "catalog" },
  { prefix: "/calendar", area: "calendar" },
  { prefix: "/stats", area: "stats" },
  { prefix: "/social", area: "social" },
];

const WORK_PREFIXES = [
  "/",
  "/calendar",
  "/projects",
  "/tasks",
  "/profile",
  "/team",
  "/social",
  "/scenes",
  "/settings",
  "/beta",
];

function pathStartsWith(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/" || pathname === "/today";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** UI hiding only — RLS still enforces the actual access. */
export function isPathAllowedForMode(
  pathname: string,
  mode: WorkspaceMode,
  areas: AreaGrants
): boolean {
  if (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/beta") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/messages")
  ) {
    return true;
  }

  if (mode === "artist") return true;

  if (mode === "work") {
    if (pathname.startsWith("/artist")) return false;
    if (pathname.startsWith("/board") || pathname.startsWith("/tracks") || pathname.startsWith("/track/")) {
      return false;
    }
    if (pathname.startsWith("/stats")) return false;
    return WORK_PREFIXES.some((prefix) => pathStartsWith(pathname, prefix));
  }

  // Entered workspace — granted tools plus always-on Artist / Team / Today / Settings.
  if (
    pathname === "/" ||
    pathname === "/today" ||
    pathname.startsWith("/artist") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/scenes")
  ) {
    return true;
  }

  for (const { prefix, area } of AREA_BY_PATH) {
    if (pathStartsWith(pathname, prefix)) {
      if (area === "tasks") return canRead(areas, "catalog");
      return canRead(areas, area);
    }
  }
  return false;
}

export function homePathForMode(mode: WorkspaceMode): string {
  if (mode === "work") return "/";
  if (mode === "entered") return "/team";
  return "/";
}
