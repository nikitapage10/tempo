import type { Momentum, TrackType } from "@/lib/types";

export const DEFAULT_SPACE_NAMES = ["Originals", "Edits & Remixes"] as const;

export const DEFAULT_STAGE_NAMES = [
  "Idea",
  "Writing",
  "Production",
  "Mixdown",
  "Master",
  "Release Prep",
  "Released",
] as const;

export const TRACK_TYPES: { value: TrackType; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "remix", label: "Remix" },
  { value: "edit", label: "Edit" },
  { value: "collab", label: "Collab" },
  { value: "bootleg", label: "Bootleg" },
];

export const MOMENTUM_OPTIONS: { value: Momentum; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "simmering", label: "Simmering" },
  { value: "stalled", label: "Stalled" },
  { value: "parked", label: "Parked" },
];

export const ACTIVE_SPACE_KEY = "tempo.activeSpaceId";
