/** Short ref → real row. Built server-side; returned with every reply. */
export type RefEntry = {
  type: "track" | "task" | "project" | "stage";
  id: string;
  /** Present on tracks and stages — used to keep stage moves in-space. */
  spaceId?: string;
  /** Present on stages — human label for confirm copy. */
  name?: string;
};

export type RefMap = Record<string, RefEntry>;

export type ActionKind =
  | "create_task"
  | "complete_task"
  | "set_task_due_date"
  | "create_track"
  | "create_project"
  | "move_track_stage"
  | "set_track_momentum"
  | "set_track_deadline"
  | "set_track_next_action"
  | "set_track_bpm"
  | "set_track_key"
  | "set_track_genre"
  | "set_track_title"
  | "set_track_type"
  | "set_track_blocked"
  | "set_track_waiting"
  | "create_support_report"
  | "navigate";

export type ProposedAction = {
  kind: ActionKind;
  label: string;
  summary: string;
  ref: string | null;
  /** Second ref — stage for move_track_stage. */
  stageRef: string | null;
  title: string | null;
  category: string | null;
  dueDate: string | null;
  momentum: string | null;
  projectType: string | null;
  /** BPM integer for set_track_bpm. */
  bpm: number | null;
  /** Musical key for set_track_key. */
  musicalKey: string | null;
  /** Track type enum for set_track_type. */
  trackType: string | null;
  href: string | null;
};

export type AssistantReply = {
  reply: string;
  action: ProposedAction | null;
  suggestions: string[];
  refs: RefMap;
  escalated: boolean;
};

export type HistoryMessage = {
  role: "artist" | "tempo";
  text: string;
};

/** One turn in the session-only transcript. */
export type Turn = {
  id: string;
  role: "artist" | "tempo";
  text: string;
  /** Labels for files the artist attached this turn. */
  attachmentNames?: string[];
  action?: ProposedAction | null;
  /** After confirm / dismiss — card becomes inert. */
  actionStatus?: "pending" | "done" | "dismissed" | "failed";
  actionDoneLabel?: string;
  suggestions?: string[];
};

/** Client + server hard cap on a single artist message. */
export const MAX_MESSAGE_CHARS = 1000;
