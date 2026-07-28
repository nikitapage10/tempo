/** Short ref → real row. Built server-side; returned with every reply. */
export type RefEntry = {
  type: "track" | "task" | "project";
  id: string;
};

export type RefMap = Record<string, RefEntry>;

export type ActionKind =
  | "create_task"
  | "complete_task"
  | "create_track"
  | "set_track_momentum"
  | "set_track_deadline"
  | "navigate";

export type ProposedAction = {
  kind: ActionKind;
  label: string;
  summary: string;
  ref: string | null;
  title: string | null;
  category: string | null;
  dueDate: string | null;
  momentum: string | null;
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
  action?: ProposedAction | null;
  /** After confirm / dismiss — card becomes inert. */
  actionStatus?: "pending" | "done" | "dismissed" | "failed";
  actionDoneLabel?: string;
  suggestions?: string[];
};

/** Client + server hard cap on a single artist message. */
export const MAX_MESSAGE_CHARS = 1000;
