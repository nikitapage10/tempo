import type { AreaGrants } from "./areas";

/**
 * Pure role → default-grants derivation, the direct analogue of
 * deriveCapabilities() in lib/permissions.ts. A role is a *starting point*,
 * not a ceiling — the artist can edit any person's grants after invite, and
 * the UI (components/settings/team-panel.tsx) marks a person as
 * "customised" once their grants diverge from their role's preset.
 */
export type MemberRole =
  | "manager"
  | "agent"
  | "tour_manager"
  | "label"
  | "assistant"
  | "custom";

export const MEMBER_ROLES: MemberRole[] = [
  "manager",
  "agent",
  "tour_manager",
  "label",
  "assistant",
  "custom",
];

export const ROLE_LABELS: Record<MemberRole, string> = {
  manager: "Manager",
  agent: "Agent",
  tour_manager: "Tour manager",
  label: "Label",
  assistant: "Assistant",
  custom: "Custom",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  manager: "Broad day-to-day access — everything but managing the team or the account itself.",
  agent: "Books and schedules — calendar and performances, read access to the catalog.",
  tour_manager: "On the road — calendar and performances, read-only everywhere else.",
  label: "Sees releases, stats and catalog; doesn't touch the day-to-day.",
  assistant: "Handles catalog upkeep and scheduling.",
  custom: "Nothing granted by default — the artist picks exactly what this person can do.",
};

export const ROLE_PRESETS: Record<MemberRole, AreaGrants> = {
  manager: {
    catalog: "write",
    calendar: "write",
    stats: "read",
    releases: "write",
    performances: "write",
    social: "read",
    team: "none",
  },
  agent: {
    catalog: "read",
    calendar: "write",
    stats: "read",
    releases: "read",
    performances: "write",
    social: "none",
    team: "none",
  },
  tour_manager: {
    catalog: "read",
    calendar: "write",
    stats: "none",
    releases: "read",
    performances: "write",
    social: "none",
    team: "none",
  },
  label: {
    catalog: "read",
    calendar: "none",
    stats: "read",
    releases: "read",
    performances: "read",
    social: "none",
    team: "none",
  },
  assistant: {
    catalog: "write",
    calendar: "write",
    stats: "none",
    releases: "none",
    performances: "read",
    social: "none",
    team: "none",
  },
  custom: {},
};

export function presetForRole(role: MemberRole): AreaGrants {
  return { ...ROLE_PRESETS[role] };
}

/** True when a person's actual grants differ from their role's stock preset. */
export function isCustomizedFromRole(role: MemberRole, areas: AreaGrants): boolean {
  const preset = ROLE_PRESETS[role];
  const keys = Array.from(new Set([...Object.keys(preset), ...Object.keys(areas)]));
  for (const key of keys) {
    const a = preset[key as keyof AreaGrants] ?? "none";
    const b = areas[key as keyof AreaGrants] ?? "none";
    if (a !== b) return true;
  }
  return false;
}
