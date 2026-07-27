export type TrackType = "original" | "remix" | "edit" | "collab" | "bootleg";

export type Momentum = "active" | "simmering" | "stalled" | "parked";

export type Space = {
  id: string;
  user_id: string;
  name: string;
  sort: number;
  accent_color: string | null;
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
  }
>;

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
