/**
 * The closed area/level vocabulary a team member can be granted access to.
 * The database (migration 089) stores grants as jsonb and only checks that
 * every value is one of "none" | "read" | "write" — this file is the actual
 * contract client and server code write against.
 *
 * Areas map onto the tables migration 090 widens: catalog → spaces/tracks/
 * projects, calendar → calendar_events, stats → platform_snapshots +
 * artist_custom_stats (read-only, on purpose — attributes/points/
 * achievements stay personal regardless of any grant), releases (not yet
 * wired to a widened policy — reserved for release_details in a later pass),
 * performances → performances, social (reserved), team (managing other
 * members — always owner-only for now, included so the UI can show it as
 * explicitly "none" rather than silently absent).
 */

export type AreaKey =
  | "catalog"
  | "audio"
  | "feedback"
  | "tasks"
  | "calendar"
  | "releases"
  | "stats"
  | "performances"
  | "social"
  | "team";

export type AreaLevel = "none" | "read" | "write";

export type AreaGrants = Partial<Record<AreaKey, AreaLevel>>;

export const AREA_KEYS: AreaKey[] = [
  "catalog",
  "audio",
  "feedback",
  "tasks",
  "calendar",
  "releases",
  "stats",
  "performances",
  "social",
  "team",
];

export const AREA_LABELS: Record<AreaKey, string> = {
  catalog: "Catalog",
  audio: "Audio & files",
  feedback: "Feedback",
  tasks: "Tasks",
  calendar: "Calendar",
  stats: "Stats",
  releases: "Releases",
  performances: "Performances",
  social: "Social",
  team: "Team",
};

export const AREA_DESCRIPTIONS: Record<AreaKey, string> = {
  catalog: "Track and project metadata, without opening files or feedback.",
  audio: "Versions, playback, downloads and supporting files.",
  feedback: "Comments, decisions and review requests.",
  tasks: "Tasks, assignments and status handoffs.",
  calendar: "Calendar events — sessions, meetings, shows.",
  stats: "Streaming numbers and custom stats. Never includes personal attributes, points, or achievements.",
  releases: "Release plans and dates.",
  performances: "The performance log that feeds Stage Presence.",
  social: "Posts, follows and messages on the artist's behalf.",
  team: "Who else has access, and to what.",
};

const AREA_LEVELS: AreaLevel[] = ["none", "read", "write"];

function isAreaLevel(value: unknown): value is AreaLevel {
  return typeof value === "string" && (AREA_LEVELS as string[]).includes(value);
}

/** Strips unknown keys/values so a hand-edited or stale row can't break render. */
export function normalizeAreas(raw: unknown): AreaGrants {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: AreaGrants = {};
  for (const key of AREA_KEYS) {
    const value = obj[key];
    if (isAreaLevel(value) && value !== "none") out[key] = value;
  }
  return out;
}

export function areaLevel(areas: AreaGrants, key: AreaKey): AreaLevel {
  return areas[key] ?? "none";
}

export function canRead(areas: AreaGrants, key: AreaKey): boolean {
  const level = areaLevel(areas, key);
  return level === "read" || level === "write";
}

export function canWrite(areas: AreaGrants, key: AreaKey): boolean {
  return areaLevel(areas, key) === "write";
}
