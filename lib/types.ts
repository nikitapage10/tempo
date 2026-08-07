export type TrackType = "original" | "remix" | "edit";

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
  /** Migration 042. Null on a database that hasn't run it yet. */
  origin_status: OriginStatus | null;
  origin_completed_at: string | null;
  origin_skipped_at: string | null;
  created_at: string;
};

/** Kept here rather than imported so lib/types stays dependency-free. */
export type OriginStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "skipped"
  | "legacy_complete";

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

export type ProfileSoundMarker = {
  label: string;
  description: string;
};

export type ProfileFeaturedMusic = {
  title: string;
  url: string;
  note: string;
};

export type ProfileStorySection = {
  title: string;
  body: string;
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
  sound_markers: ProfileSoundMarker[];
  current_focus_title: string | null;
  current_focus_body: string | null;
  featured_music: ProfileFeaturedMusic[];
  story_sections: ProfileStorySection[];
  pronouns: string | null;
  visibility: ProfileVisibility;
  published_at: string | null;
  accepts_dms: ProfileDmPolicy;
  /** Up to 8 artist_profiles ids — the owner's curated quick-access picks on Social. */
  top8: string[];
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
  sound_markers: ProfileSoundMarker[];
  current_focus_title: string | null;
  current_focus_body: string | null;
  featured_music: ProfileFeaturedMusic[];
  story_sections: ProfileStorySection[];
  pronouns: string | null;
  visibility: ProfileVisibility;
  accepts_dms: ProfileDmPolicy;
  top8: string[];
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
    | "location"
    | "country_code"
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
  /**
   * Scenes layer (migrations 050/051). Null on every home-feed post — a post
   * with a scene_id never reaches home_timeline, and a post without one can
   * never carry a topic, a non-"post" kind, or a schedule.
   */
  scene_id: string | null;
  scene_topic_id: string | null;
  kind: ScenePostKind;
  pinned_at: string | null;
  scheduled_for: string | null;
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
  archived_at?: string | null;
};

export type MessageAttachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  sender_user_id: string;
  body: string;
  media: (string | MessageAttachment)[];
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
  /**
   * Where the run of ungrouped tracks sits among the groups on Tracks
   * (migration 044). -1 by default, i.e. above every group.
   */
  ungrouped_sort: number;
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
  spotify_track_id: string | null;
  spotify_url: string | null;
  spotify_album_id: string | null;
  spotify_album_name: string | null;
  spotify_album_url: string | null;
  spotify_release_date: string | null;
  spotify_release_date_precision: "year" | "month" | "day" | null;
  spotify_isrc: string | null;
  spotify_duration_ms: number | null;
  spotify_explicit: boolean | null;
  spotify_track_number: number | null;
  spotify_disc_number: number | null;
  spotify_artist_names: string[];
  spotify_synced_at: string | null;
  next_action: string | null;
  next_action_due: string | null;
  blocked_reason: string | null;
  waiting_on: string | null;
  stage_entered_at: string;
  list_sort: number;
  /** Tracks-page group (migration 041). Independent of project_id. */
  list_group_id: string | null;
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
    list_group_id?: string | null;
  }
>;

/** Named Tracks-page group (album / EP / playlist / etc). Migration 041. */
/**
 * One of the fixed tints a group can carry (migration 044), plus "custom" —
 * a free color, stored in `accent_hex` (migration 045).
 */
export type TrackGroupAccent = "ice" | "amber" | "violet" | "ok" | "warn" | "custom";

export type TrackGroup = {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  sort: number;
  /** Storage path of the optional album/EP image. Private bucket. */
  cover_url: string | null;
  accent_color: TrackGroupAccent | null;
  /** Set only when accent_color is "custom". `#RRGGBB`. */
  accent_hex: string | null;
  created_at: string;
  updated_at: string;
};

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

/* ==========================================================================
 * Scenes — communities (migrations 049–054)
 *
 * A Scene grants access to the ROOM, never to anyone's catalog. Nothing in
 * this block ever carries track, space, or project data belonging to another
 * artist — the only creative content that crosses is what someone
 * deliberately posted, and that arrives frozen in Post.attachment_snapshot.
 * ========================================================================== */

export type SceneKind =
  | "label"
  | "school"
  | "crew"
  | "collective"
  | "genre"
  | "local"
  | "other";

/** How someone gets in. `invite` refuses join_scene() outright. */
export type SceneJoinPolicy = "open" | "request" | "invite";

/**
 * `public` is reserved for the phase-3 /s/[slug] link and behaves exactly
 * like `members` until that ships — there is deliberately no anon policy.
 */
export type SceneVisibility = "members" | "unlisted" | "public";

export type SceneRole = "owner" | "moderator" | "member";

export type SceneMemberStatus =
  | "active"
  | "pending"
  | "invited"
  | "banned"
  | "left";

/** Surfaces a scene can switch off. An absent key reads as enabled. */
export type SceneFeatures = {
  feed?: boolean;
  polls?: boolean;
  events?: boolean;
  chat?: boolean;
  directory?: boolean;
};

export type SceneWelcomeStep = {
  id: string;
  label: string;
  /** In-app path or external URL. */
  href?: string | null;
};

export type Scene = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  kind: SceneKind;
  owner_profile_id: string;
  owner_user_id: string;
  join_policy: SceneJoinPolicy;
  visibility: SceneVisibility;
  emblem_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  banner_color_end: string | null;
  /**
   * The scene's accent pair. Applied to a SCOPED wrapper only — never to
   * document.documentElement, which stays the active artist's theme so
   * "ice = interactive" keeps meaning one thing app-wide.
   */
  palette_id: ArtistPaletteId;
  ice_color: string | null;
  amber_color: string | null;
  location: string | null;
  country_code: string | null;
  genres: string[];
  links: ProfileLink[];
  features: SceneFeatures;
  welcome_checklist: SceneWelcomeStep[];
  recognition_enabled: boolean;
  parent_scene_id: string | null;
  member_count: number;
  post_count: number;
  last_activity_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Filled by the API for the signed-in caller. */
  my_role?: SceneRole | null;
  my_status?: SceneMemberStatus | null;
  /** last_activity_at is newer than my last_read_at. Cheap unread dot. */
  has_unread?: boolean;
};

export type SceneMember = {
  scene_id: string;
  profile_id: string;
  user_id: string;
  role: SceneRole;
  status: SceneMemberStatus;
  invited_by_profile_id: string | null;
  request_note: string | null;
  joined_at: string | null;
  last_read_at: string | null;
  muted: boolean;
  welcome_steps_done: string[];
  /** Phase-2 recognition fields — present but unused in phase 1. */
  points: number;
  streak_days: number;
  last_active_on: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<
    ArtistProfile,
    | "id"
    | "handle"
    | "display_name"
    | "emblem_url"
    | "palette_id"
    | "ice_color"
    | "amber_color"
    | "location"
  > | null;
};

export type SceneTopicKind = "feed" | "announcements";
export type SceneTopicPostPolicy = "members" | "moderators";

export type SceneTopic = {
  id: string;
  scene_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  kind: SceneTopicKind;
  post_policy: SceneTopicPostPolicy;
  features: Record<string, boolean>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** `question` carries no options — answers are ordinary post comments. */
export type ScenePostKind = "post" | "poll" | "question" | "announcement";

export type ScenePollKind = "poll" | "question";

export type ScenePollOption = {
  id: string;
  poll_id: string;
  scene_id: string;
  label: string;
  sort_order: number;
  vote_count: number;
};

export type ScenePoll = {
  id: string;
  post_id: string;
  scene_id: string;
  kind: ScenePollKind;
  multi_choice: boolean;
  closes_at: string | null;
  closed_at: string | null;
  total_votes: number;
  created_at: string;
  options?: ScenePollOption[];
  /** Option ids the caller's scene profile has picked. */
  my_option_ids?: string[];
};

export type SceneEventKind =
  | "session"
  | "show"
  | "listening"
  | "meeting"
  | "workshop"
  | "other";

export type SceneRsvpResponse = "going" | "interested" | "not_going";

export type SceneEvent = {
  id: string;
  scene_id: string;
  created_by_profile_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  kind: SceneEventKind;
  /** Same temporal shape as CalendarEvent — all_day XOR timestamped. */
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  capacity: number | null;
  rsvp_deadline: string | null;
  going_count: number;
  interested_count: number;
  announce_post_id: string | null;
  mirror_calendar_event_id: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  my_response?: SceneRsvpResponse | null;
};

export type SceneEventRsvp = {
  event_id: string;
  profile_id: string;
  scene_id: string;
  user_id: string;
  response: SceneRsvpResponse;
  note: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<
    ArtistProfile,
    "id" | "handle" | "display_name" | "emblem_url" | "palette_id"
  > | null;
};

export type SceneModerationAction =
  | "pin"
  | "unpin"
  | "remove_post"
  | "restore_post"
  | "mute"
  | "unmute"
  | "ban"
  | "unban"
  | "approve"
  | "reject"
  | "role_change"
  | "escalate";

export type SceneModerationLogEntry = {
  id: string;
  scene_id: string;
  actor_profile_id: string | null;
  action: SceneModerationAction;
  target_type: "post" | "post_comment" | "member";
  target_id: string;
  note: string | null;
  created_at: string;
};
