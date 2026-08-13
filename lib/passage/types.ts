/**
 * PASSAGE domain types. Mirrors migration 094 — keep the unions in step with
 * the check constraints there.
 */

export type PassageStatus = "in_progress" | "complete" | "skipped";

/**
 * Stable resume points. Deliberately coarser than the experience state
 * machine: a transition is never a resume target, so a refresh mid-transition
 * lands on the loop the member was heading into.
 */
export type PassageStep =
  | "role"
  | "entry"
  | "support"
  | "function"
  | "look"
  | "story"
  | "complete";

export type MemberPassage = {
  status: PassageStatus;
  currentStep: PassageStep;
  roleTitle: string | null;
  roleTitleOther: string | null;
  entryText: string | null;
  supportsText: string | null;
  functionText: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

/** What a draft save may change. Every field optional — saves are incremental. */
export type PassageDraftPatch = {
  currentStep?: PassageStep;
  roleTitle?: string | null;
  roleTitleOther?: string | null;
  entryText?: string | null;
  supportsText?: string | null;
  functionText?: string | null;
};

/** Raw database row shape, for the mapping functions. */
export type MemberPassageRow = {
  status: PassageStatus;
  current_step: PassageStep;
  role_title: string | null;
  role_title_other: string | null;
  entry_text: string | null;
  supports_text: string | null;
  function_text: string | null;
  completed_at: string | null;
  updated_at: string | null;
};

export function rowToPassage(row: MemberPassageRow): MemberPassage {
  return {
    status: row.status,
    currentStep: row.current_step,
    roleTitle: row.role_title,
    roleTitleOther: row.role_title_other,
    entryText: row.entry_text,
    supportsText: row.supports_text,
    functionText: row.function_text,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
