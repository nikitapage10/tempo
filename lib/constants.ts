import type {
  AssetKind,
  CollaboratorRole,
  DecisionArea,
  DecisionType,
  MilestoneType,
  Momentum,
  ProjectType,
  ReferenceKind,
  SpaceFocus,
  TaskCategory,
  TaskStatus,
  TrackType,
  WorkspacePreset,
} from "@/lib/types";

/** Client-side upload cap for versions and assets. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** How many bounces to keep per track (newest wins; older ones are removed). */
export const MAX_VERSIONS_PER_TRACK = 2;

export const AUDIO_ACCEPT =
  ".mp3,.wav,.aiff,.aif,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/mp4,audio/x-m4a";

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".aiff", ".aif", ".m4a"] as const;

/**
 * What Import Studio accepts. Lives here rather than next to the parsers in
 * lib/ai/extract-sources.ts so the intake screen can import it without dragging
 * exceljs, mammoth and node:stream into the browser bundle. Keep the two in step.
 */
export const IMPORT_DOCUMENT_ACCEPT = ".csv,.xlsx,.xlsm,.pdf,.docx,.txt,.md,.json,.rtf";
export const IMPORT_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.heic,image/*";

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

export const SPACE_FOCUS_OPTIONS: { value: SpaceFocus; label: string; description: string }[] = [
  { value: "music", label: "Music", description: "Board and stage pipeline for tracks" },
  { value: "tasks", label: "Tasks & projects", description: "No board — just tasks and projects" },
];

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

export const MILESTONE_TYPES: { value: MilestoneType; label: string }[] = [
  { value: "demo", label: "Demo" },
  { value: "vocal_comp", label: "Vocal comp" },
  { value: "arrangement_lock", label: "Arrangement lock" },
  { value: "mix_approved", label: "Mix approved" },
  { value: "master", label: "Master" },
  { value: "custom", label: "Custom" },
];

export const DECISION_TYPES: { value: DecisionType; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "needs_changes", label: "Needs changes" },
  { value: "rejected", label: "Rejected" },
];

export const DECISION_AREAS: { value: DecisionArea; label: string }[] = [
  { value: "general", label: "General" },
  { value: "arrangement", label: "Arrangement" },
  { value: "vocal", label: "Vocal" },
  { value: "mix", label: "Mix" },
  { value: "master", label: "Master" },
  { value: "release", label: "Release" },
];

export const REFERENCE_KINDS: { value: ReferenceKind; label: string }[] = [
  { value: "audio", label: "Audio" },
  { value: "image", label: "Image" },
  { value: "link", label: "Link" },
  { value: "note", label: "Note" },
];

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
  { value: "edit_pack", label: "Edit pack" },
];

export const COLLABORATOR_ROLES: { value: CollaboratorRole; label: string; description: string }[] = [
  { value: "editor", label: "Editor", description: "Edit metadata/workflow, upload, resolve comments" },
  { value: "uploader", label: "Uploader", description: "Upload versions only" },
  { value: "commenter", label: "Commenter", description: "Play versions and leave comments" },
  { value: "viewer", label: "Viewer", description: "Play versions and read-only access" },
];

export const WORKSPACE_PRESETS: { value: WorkspacePreset; label: string; description: string }[] = [
  { value: "writing", label: "Writing", description: "Notes and checklist up front, files tucked away" },
  { value: "production", label: "Production", description: "The balanced default — everything visible" },
  { value: "feedback", label: "Feedback", description: "Comments and people front and center" },
  { value: "mix_review", label: "Mix review", description: "Versions and comments dominate" },
  { value: "release_prep", label: "Release prep", description: "Files, details, and tasks prioritized" },
  { value: "custom", label: "Custom", description: "Your own module order" },
];

/** Stage names (case-insensitive) that get an explicit "Add suggested recipe" offer (FEATURE-SPECS §9). */
export const SUGGESTED_RECIPE_STAGE_NAMES = [
  "writing",
  "production",
  "mixdown",
  "master",
  "release prep",
] as const;

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
