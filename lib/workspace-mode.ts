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

function finishedAsMusician(
  status: Artist["origin_status"] | null | undefined
): boolean {
  return status === "complete" || status === "skipped";
}

/**
 * An owned row is a music artist when it was tagged that way and the person
 * actually finished (or skipped) Origin as a musician. Team-only accounts
 * used to get leftover Artist rows named from their email; those read as a
 * personal home even if `workspace_kind` never landed.
 */
export function classifyOwnedKind(
  artist: Pick<Artist, "user_id" | "workspace_kind" | "origin_status">,
  userId: string | null | undefined,
  hasMembership: boolean
): WorkspaceKind | null {
  if (!userId || artist.user_id !== userId) return null;
  if (artist.workspace_kind === "personal") return "personal";
  if (
    hasMembership &&
    !finishedAsMusician(artist.origin_status) &&
    artist.origin_status !== "in_progress"
  ) {
    return "personal";
  }
  return "artist";
}

/** What shell the signed-in person is in for the currently active artist row. */
export function resolveWorkspaceMode(
  artist: Artist | null | undefined,
  userId: string | null | undefined,
  roster: Artist[] = []
): WorkspaceMode {
  if (!artist || !userId) return "work";
  if (artist.user_id !== userId) return "entered";
  const hasMembership = membershipArtists(roster, userId).length > 0;
  return classifyOwnedKind(artist, userId, hasMembership) === "personal"
    ? "work"
    : "artist";
}

export function ownedPersonalHomes(
  artists: Artist[],
  userId: string | null | undefined
): Artist[] {
  if (!userId) return [];
  const hasMembership = membershipArtists(artists, userId).length > 0;
  return artists.filter(
    (a) => classifyOwnedKind(a, userId, hasMembership) === "personal"
  );
}

export function ownedPersonalWorkspace(
  artists: Artist[],
  userId: string | null | undefined
): Artist | null {
  const homes = ownedPersonalHomes(artists, userId);
  return (
    homes.find((a) => a.workspace_kind === "personal") ??
    homes.find((a) => a.emblem_url || a.logo_url) ??
    homes[0] ??
    null
  );
}

export function ownedMusicArtists(
  artists: Artist[],
  userId: string | null | undefined
): Artist[] {
  if (!userId) return [];
  const hasMembership = membershipArtists(artists, userId).length > 0;
  return artists.filter(
    (a) => classifyOwnedKind(a, userId, hasMembership) === "artist"
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
 * Resume this account's last artist. If that pointer is gone (sign-out used
 * to wipe it), don't dump a demo catalog account onto an empty Home — open
 * the demo artist so the board still has its tracks.
 */
export function pickResumeArtistId(
  artists: Artist[],
  userId: string | null | undefined,
  storedId: string | null | undefined
): string | null {
  if (storedId && artists.some((a) => a.id === storedId)) return storedId;
  const fallback = pickDefaultArtistId(artists, userId);
  const demo = artists.find((a) => a.demo_kind) ?? null;
  if (!demo || !fallback || demo.id === fallback) return fallback;
  const fallbackArtist = artists.find((a) => a.id === fallback);
  const hasMembership = membershipArtists(artists, userId).length > 0;
  if (
    fallbackArtist &&
    classifyOwnedKind(fallbackArtist, userId, hasMembership) === "personal"
  ) {
    return demo.id;
  }
  return fallback;
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
  const mode = resolveWorkspaceMode(activeArtist, userId, artists);
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

/** Own identity editor and the old Team-under-Artist path — not a handle. */
function isStudioArtistPath(pathname: string): boolean {
  return (
    pathname === "/artist" ||
    pathname === "/artist/" ||
    pathname === "/artist/team" ||
    pathname.startsWith("/artist/team/")
  );
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
    // Studio identity stays off-limits. Network profiles at /artist/[handle]
    // are how Discover and Social open another artist — not the editor at /artist.
    if (isStudioArtistPath(pathname)) return false;
    if (pathname.startsWith("/artist/")) return true;
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
  if (mode === "work") return "/team";
  if (mode === "entered") return "/team";
  return "/";
}
