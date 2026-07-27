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

export type Session = {
  id: string;
  track_id: string;
  version_id: string | null;
  note: string;
  logged_at: string;
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

export type Project = {
  id: string;
  user_id: string;
  space_id: string | null;
  name: string;
  description: string | null;
  deadline: string | null;
  status: ProjectStatus;
  created_at: string;
};

export type ProjectInsert = {
  name: string;
  description?: string | null;
  deadline?: string | null;
  space_id?: string | null;
  status?: ProjectStatus;
};

export type ProjectUpdate = Partial<
  Pick<Project, "name" | "description" | "deadline" | "space_id" | "status">
>;

export type ProjectWithStats = Project & {
  track_count: number;
  task_count: number;
  checklist_pct: number | null;
};
