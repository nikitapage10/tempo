export type TrackType = "original" | "remix" | "edit" | "collab" | "bootleg";

export type Momentum = "active" | "simmering" | "stalled" | "parked";

export type SpaceFocus = "music" | "tasks";

/** Key into ARTIST_PALETTES (lib/artist-theme.ts). "spectra" is the default, unmodified look. */
export type ArtistPaletteId = string;

export type Artist = {
  id: string;
  user_id: string;
  name: string;
  /** Wide lockup — Today hero. */
  logo_url: string | null;
  /** Square identity mark — settings chip, switcher list. */
  emblem_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  /** Optional second stop for a banner color gradient. */
  banner_color_end: string | null;
  palette_id: ArtistPaletteId;
  /** Free Cool accent override; null = use palette_id preset. */
  ice_color: string | null;
  /** Free Warm accent override; null = use palette_id preset. */
  amber_color: string | null;
  sort: number;
  /** Linked platform profiles — see migration 024. Null = not linked. */
  spotify_artist_id: string | null;
  soundcloud_user_id: string | null;
  apple_artist_id: string | null;
  created_at: string;
};

export type ArtistUpdate = Partial<{
  name: string;
  logo_url: string | null;
  emblem_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  banner_color_end: string | null;
  palette_id: ArtistPaletteId;
  ice_color: string | null;
  amber_color: string | null;
  sort: number;
  spotify_artist_id: string | null;
  soundcloud_user_id: string | null;
  apple_artist_id: string | null;
}>;

export type ProfileVisibility = "private" | "members" | "public";
export type ProfileDmPolicy = "anyone" | "connections" | "nobody";

export type ProfileLink = {
  label: string;
  url: string;
};

/**
 * The public-facing artist profile — migration 028. A separate 1:1 table
 * from `artists`, not new columns on it: identity fields are mirrored in by
 * trigger, and no social read path ever joins `artists` directly. See
 * migrations/028_artist_profiles.sql.
 */
export type ArtistProfile = {
  id: string;
  artist_id: string;
  owner_user_id: string;
  /** Secondary identity (Discord model) — for share links and @mentions only. */
  handle: string | null;
  display_name: string;
  emblem_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  banner_color_end: string | null;
  ice_color: string | null;
  amber_color: string | null;
  palette_id: ArtistPaletteId;
  tagline: string | null;
  bio: string | null;
  backstory: string | null;
  location: string | null;
  country_code: string | null;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
  pronouns: string | null;
  visibility: ProfileVisibility;
  published_at: string | null;
  accepts_dms: ProfileDmPolicy;
  created_at: string;
  updated_at: string;
};

export type ArtistProfileUpdate = Partial<{
  handle: string | null;
  tagline: string | null;
  bio: string | null;
  backstory: string | null;
  location: string | null;
  country_code: string | null;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
  pronouns: string | null;
  visibility: ProfileVisibility;
  accepts_dms: ProfileDmPolicy;
}>;

/** Private CRM contact — migration 029. Scoped to the owning account only. */
export type PersonSource =
  | "manual"
  | "collaborator"
  | "guest_review"
  | "release_credit"
  | "import";

export type Person = {
  id: string;
  user_id: string;
  display_name: string;
  linked_profile_id: string | null;
  linked_user_id: string | null;
  primary_email: string | null;
  roles: string[];
  tags: string[];
  notes: string | null;
  avatar_url: string | null;
  source: PersonSource;
  is_archived: boolean;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined when listing for the Social page. */
  linked_profile?: Pick<
    ArtistProfile,
    | "id"
    | "handle"
    | "display_name"
    | "emblem_url"
    | "palette_id"
    | "ice_color"
    | "amber_color"
    | "visibility"
  > | null;
  appearance_count?: number;
};

export type PersonAppearance = {
  id: string;
  user_id: string;
  person_id: string;
  source: PersonSource;
  role: string | null;
  track_id: string | null;
  project_id: string | null;
  guest_link_id: string | null;
  label: string | null;
  appeared_at: string;
  created_at: string;
};

export type ProfileFollow = {
  follower_profile_id: string;
  followee_profile_id: string;
  created_at: string;
};

export type PostVisibility = "followers" | "members" | "public";

export type PostAttachmentSnapshot = {
  track_id: string;
  title: string;
  artwork_url: string | null;
  artist_name: string | null;
};

export type Post = {
  id: string;
  author_profile_id: string;
  author_user_id: string;
  body: string;
  media: string[];
  track_id: string | null;
  project_id: string | null;
  attachment_snapshot: PostAttachmentSnapshot | null;
  visibility: PostVisibility;
  reply_to_post_id: string | null;
  like_count: number;
  comment_count: number;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<
    ArtistProfile,
    | "id"
    | "handle"
    | "display_name"
    | "emblem_url"
    | "palette_id"
    | "ice_color"
    | "amber_color"
  > | null;
  liked_by_me?: boolean;
};

export type PostComment = {
  id: string;
  post_id: string;
  author_profile_id: string;
  author_user_id: string;
  parent_comment_id: string | null;
  body: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<
    ArtistProfile,
    "id" | "handle" | "display_name" | "emblem_url" | "palette_id"
  > | null;
};

export type Conversation = {
  id: string;
  kind: "direct" | "group";
  direct_key: string | null;
  title: string | null;
  created_by_profile_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  /** Other participant(s) for direct threads — filled by the API. */
  peer?: Pick<
    ArtistProfile,
    | "id"
    | "handle"
    | "display_name"
    | "emblem_url"
    | "palette_id"
    | "ice_color"
    | "amber_color"
  > | null;
  unread_count?: number;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  sender_user_id: string;
  body: string;
  media: string[];
  deleted_at: string | null;
  created_at: string;
};

export type Space = {
  id: string;
  user_id: string;
  artist_id: string;
  name: string;
  sort: number;
  accent_color: string | null;
  focus: SpaceFocus;
  created_at: string;
};

export type Stage = {
  id: string;
  space_id: string;
  name: string;
  sort: number;
  color: string | null;
  created_at: string;
};

export type Track = {
  id: string;
  user_id: string;
  space_id: string;
  project_id: string | null;
  stage_id: string | null;
  title: string;
  artist_alias: string | null;
  type: TrackType;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  destination: string | null;
  deadline: string | null;
  momentum: Momentum;
  tags: string[];
  notes: string | null;
  artwork_url: string | null;
  next_action: string | null;
  next_action_due: string | null;
  blocked_reason: string | null;
  waiting_on: string | null;
  stage_entered_at: string;
  list_sort: number;
  created_at: string;
  updated_at: string;
};

export type TrackInsert = {
  space_id: string;
  stage_id: string | null;
  title: string;
  type: TrackType;
  artist_alias?: string | null;
  bpm?: number | null;
  musical_key?: string | null;
  genre?: string | null;
  destination?: string | null;
  deadline?: string | null;
  momentum?: Momentum;
  tags?: string[];
  notes?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  blocked_reason?: string | null;
  waiting_on?: string | null;
};

export type TrackUpdate = Partial<
  Omit<TrackInsert, "space_id"> & {
    space_id?: string;
    updated_at?: string;
    artwork_url?: string | null;
    project_id?: string | null;
    list_sort?: number;
  }
>;

/** Named snapshot of Tracks-page order within a space (migration 018). */
export type TrackListPreset = {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  track_ids: string[];
  created_at: string;
  updated_at: string;
};

/** Board-only sticky note — not a track; never listed in Tracks / Today. */
export type BoardNote = {
  id: string;
  user_id: string;
  space_id: string;
  stage_id: string;
  title: string;
  body: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type BoardNoteInsert = {
  space_id: string;
  stage_id: string;
  title: string;
  body?: string | null;
  sort?: number;
};

export type BoardNoteUpdate = Partial<{
  stage_id: string;
  title: string;
  body: string | null;
  sort: number;
  updated_at: string;
}>;

export type ChecklistItem = {
  id: string;
  track_id: string;
  text: string;
  done: boolean;
  sort: number;
  created_at: string;
};

export type ChecklistItemInsert = {
  track_id: string;
  text: string;
  done?: boolean;
  sort?: number;
};

export type ChecklistItemUpdate = Partial<
  Pick<ChecklistItem, "text" | "done" | "sort">
>;

export type TemplateItem = {
  text: string;
  sort: number;
};

export type ChecklistTemplate = {
  id: string;
  user_id: string;
  name: string;
  items: TemplateItem[];
  created_at: string;
};

export type MilestoneType =
  | "demo"
  | "vocal_comp"
  | "arrangement_lock"
  | "mix_approved"
  | "master"
  | "custom";

export type Version = {
  id: string;
  track_id: string;
  version_no: number;
  label: string | null;
  changelog: string | null;
  file_url: string;
  file_size: number | null;
  duration: number | null;
  is_current: boolean;
  is_pinned: boolean;
  milestone_type: MilestoneType | null;
  milestone_label: string | null;
  pinned_at: string | null;
  created_at: string;
};

export type DecisionType = "approved" | "needs_changes" | "rejected";
export type DecisionArea =
  | "general"
  | "arrangement"
  | "vocal"
  | "mix"
  | "master"
  | "release";

export type VersionDecision = {
  id: string;
  track_id: string;
  version_id: string;
  decision_type: DecisionType;
  decision_area: DecisionArea;
  note: string | null;
  created_by_user_id: string | null;
  guest_name: string | null;
  guest_link_id: string | null;
  created_at: string;
};

export type AssetKind =
  | "stem"
  | "midi"
  | "artwork"
  | "lyrics"
  | "reference"
  | "other";

export type Asset = {
  id: string;
  track_id: string;
  kind: AssetKind;
  name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
};

export type SessionStatus = "active" | "completed" | "abandoned";

export type Session = {
  id: string;
  track_id: string;
  version_id: string | null;
  user_id: string | null;
  note: string;
  logged_at: string;
  status: SessionStatus;
  goal: string | null;
  outcome: string | null;
  started_at: string | null;
  ended_at: string | null;
  elapsed_sec: number | null;
  next_action_after: string | null;
  created_at: string | null;
};

export type TaskCategory =
  | "social"
  | "outreach"
  | "pitching"
  | "admin"
  | "production"
  | "other";

export type TaskStatus = "todo" | "doing" | "done";

export type Task = {
  id: string;
  user_id: string;
  track_id: string | null;
  project_id: string | null;
  space_id: string | null;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

export type TaskInsert = {
  title: string;
  category?: TaskCategory;
  status?: TaskStatus;
  due_date?: string | null;
  notes?: string | null;
  track_id?: string | null;
  project_id?: string | null;
  space_id?: string | null;
};

export type TaskUpdate = Partial<
  Pick<Task, "title" | "category" | "status" | "due_date" | "notes" | "track_id" | "project_id">
>;

export type ProjectStatus = "active" | "done" | "parked";
export type ProjectType = "general" | "single" | "ep" | "album" | "edit_pack";

export type Project = {
  id: string;
  user_id: string;
  space_id: string | null;
  name: string;
  description: string | null;
  deadline: string | null;
  status: ProjectStatus;
  project_type: ProjectType;
  created_at: string;
};

export type ProjectInsert = {
  name: string;
  description?: string | null;
  deadline?: string | null;
  space_id?: string | null;
  status?: ProjectStatus;
  project_type?: ProjectType;
};

export type ProjectUpdate = Partial<
  Pick<Project, "name" | "description" | "deadline" | "space_id" | "status" | "project_type">
>;

export type ProjectWithStats = Project & {
  track_count: number;
  task_count: number;
  checklist_pct: number | null;
};

export type Comment = {
  id: string;
  version_id: string;
  track_id: string;
  timestamp_sec: number | null;
  text: string;
  resolved: boolean;
  author_user_id: string | null;
  parent_id: string | null;
  assigned_to_user_id: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  guest_name: string | null;
  guest_link_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestReviewLink = {
  id: string;
  track_id: string;
  version_id: string;
  created_by: string;
  token_hash: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  allow_comments: boolean;
  allow_download: boolean;
  created_at: string;
  last_accessed_at: string | null;
};

export type RecipeExecutionMode = "preview" | "automatic";

export type StageRecipeAction =
  | { type: "apply_checklist_template"; template_id: string }
  | { type: "create_task"; title: string; category?: TaskCategory; due_offset_days?: number }
  | { type: "set_next_action"; next_action: string; next_action_due?: string | null }
  | { type: "set_momentum"; momentum: Momentum }
  | { type: "request_version_decision"; decision_area?: DecisionArea; note?: string };

export type StageRecipe = {
  id: string;
  stage_id: string;
  enabled: boolean;
  execution_mode: RecipeExecutionMode;
  actions: StageRecipeAction[];
  created_at: string;
  updated_at: string;
};

export type StageRecipeRunStatus =
  | "pending"
  | "applied"
  | "skipped"
  | "partial"
  | "failed";

export type StageRecipeRun = {
  id: string;
  recipe_id: string;
  track_id: string;
  stage_id: string;
  transition_key: string;
  status: StageRecipeRunStatus;
  action_results: unknown[];
  created_at: string;
  completed_at: string | null;
};

export type ReferenceKind = "audio" | "image" | "link" | "note";

export type TrackReference = {
  id: string;
  track_id: string;
  kind: ReferenceKind;
  title: string;
  url: string | null;
  asset_id: string | null;
  note: string | null;
  start_sec: number | null;
  end_sec: number | null;
  intent: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type ReleaseDetails = {
  project_id: string;
  release_date: string | null;
  label_name: string | null;
  distributor: string | null;
  catalog_number: string | null;
  upc: string | null;
  pre_save_url: string | null;
  live_url: string | null;
  pitching_deadline: string | null;
  submitted_at: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseTrackMetadata = {
  id: string;
  project_id: string;
  track_id: string;
  track_number: number | null;
  version_title: string | null;
  isrc: string | null;
  explicit: boolean;
  primary_artist: string | null;
  featured_artists: string[];
  writers: string[];
  producers: string[];
  mix_engineer: string | null;
  mastering_engineer: string | null;
};

export type CollaboratorRole = "editor" | "uploader" | "commenter" | "viewer";
export type CollaboratorStatus = "pending" | "active" | "revoked";

export type TrackCollaborator = {
  id: string;
  track_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  invited_by: string;
  invite_token_hash: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type ActivityEvent = {
  id: string;
  track_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  track_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  /** Social layer additions (migration 028) — null on catalog notifications. */
  actor_profile_id: string | null;
  target_profile_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link_url: string | null;
  group_key: string | null;
};

export type WorkspacePreset =
  | "writing"
  | "production"
  | "feedback"
  | "mix_review"
  | "release_prep"
  | "custom";

export type WorkspacePreference = {
  id: string;
  user_id: string;
  track_id: string | null;
  stage_id: string | null;
  preset: WorkspacePreset;
  module_order: string[];
  hidden_modules: string[];
  default_panel: string | null;
  compact_mode: boolean;
  /**
   * Two-column module layout (migration 012). Null on rows saved before it.
   * Each column holds slots; a slot with several ids renders as a tab group.
   */
  module_layout: {
    left: string[][];
    right: string[][];
    leftPct?: number;
  } | null;
  updated_at: string;
};

/** A user-saved track-workspace arrangement (migration 013). */
export type LayoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  layout: {
    left: string[][];
    right: string[][];
    leftPct?: number;
  };
  created_at: string;
  updated_at: string;
};

export type AttentionSeverity = "info" | "warn" | "critical";

export type AttentionSignal = {
  id: string;
  label: string;
  severity: AttentionSeverity;
  explanation: string;
};
