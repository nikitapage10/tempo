import type {
  AssetKind,
  Momentum,
  TaskCategory,
  TaskStatus,
  TrackType,
} from "@/lib/types";

/** Client-side upload cap for versions and assets. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export const AUDIO_ACCEPT =
  ".mp3,.wav,.aiff,.aif,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mp4,audio/x-m4a";

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".aiff", ".aif", ".m4a"] as const;

export const ASSET_KINDS: { value: AssetKind; label: string }[] = [
  { value: "stem", label: "Stem" },
  { value: "midi", label: "MIDI" },
  { value: "artwork", label: "Artwork" },
  { value: "lyrics", label: "Lyrics" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

export const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "social", label: "Social" },
  { value: "outreach", label: "Outreach" },
  { value: "pitching", label: "Pitching" },
  { value: "admin", label: "Admin" },
  { value: "production", label: "Production" },
  { value: "other", label: "Other" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

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

/** Built-in checklist templates seeded on first login. */
export const DEFAULT_CHECKLIST_TEMPLATES: {
  name: string;
  items: string[];
}[] = [
  {
    name: "Arrangement",
    items: [
      "Lock the core idea / hook",
      "Map structure (intro → drop → outro)",
      "Write A / B sections",
      "Add transitions and fills",
      "Check energy arc start to finish",
      "Mute pass — cut anything that isn’t earning space",
      "Export a rough bounce for feedback",
    ],
  },
  {
    name: "Mixdown",
    items: [
      "Gain stage and clean clips",
      "Balance levels before FX",
      "EQ carve for kick / bass conflict",
      "Space: reverb / delay sends",
      "Check mono compatibility",
      "Reference against 2–3 tracks",
      "Export mixbounce + note changes",
    ],
  },
  {
    name: "Master Prep",
    items: [
      "Confirm final mix is locked",
      "Leave headroom (~−6 dB true peak)",
      "Check loudness vs. destination",
      "True peak / limiter pass",
      "Export master + instrumental",
      "A/B vs. commercial reference",
      "Listen on phone + monitors",
      "Archive project + stems snapshot",
    ],
  },
  {
    name: "Release Prep",
    items: [
      "Final master approved",
      "Artwork locked (3000×3000+)",
      "Metadata: title, artist, ISRC",
      "Upload to distributor / label",
      "Write release blurb / bio line",
      "Schedule social posts",
      "Pitch list (playlists / blogs / DJs)",
      "Set release date reminder",
    ],
  },
];
