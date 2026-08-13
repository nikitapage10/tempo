/**
 * PASSAGE domain types. Mirrors migrations 094 and 096. Keep the unions in
 * step with the check constraints there.
 */

export type PassageStatus = "in_progress" | "complete" | "skipped";

/**
 * Stable resume points. Deliberately coarser than the experience state
 * machine: a transition is never a resume target, so a refresh mid-transition
 * lands on the loop the member was heading into.
 */
export type PassageStep =
  | "name"
  | "describe"
  | "entry"
  | "support"
  | "function"
  | "look"
  | "processing"
  | "story"
  | "complete";

export type PassageStorySection = {
  title: string;
  body: string;
};

/**
 * The closing scroll, written by TEMPO from the member's answers rather than
 * echoed back verbatim. Editable before it is kept, exactly like Origin's.
 */
export type PassageInterpretation = {
  headline: string;
  intro: string;
  storySections: PassageStorySection[];
};

export const EMPTY_PASSAGE_INTERPRETATION: PassageInterpretation = {
  headline: "",
  intro: "",
  storySections: [],
};

export type MemberPassage = {
  status: PassageStatus;
  currentStep: PassageStep;
  displayName: string | null;
  /** A person is routinely more than one of these. */
  roleTitles: string[];
  roleTitleOther: string | null;
  entryText: string | null;
  supportsText: string | null;
  functionText: string | null;
  interpretation: PassageInterpretation | null;
  completedAt: string | null;
  updatedAt: string | null;
};

/** What a draft save may change. Every field optional, saves are incremental. */
export type PassageDraftPatch = {
  currentStep?: PassageStep;
  displayName?: string | null;
  roleTitles?: string[];
  roleTitleOther?: string | null;
  entryText?: string | null;
  supportsText?: string | null;
  functionText?: string | null;
  interpretation?: PassageInterpretation | null;
};

/** Raw database row shape, for the mapping functions. */
export type MemberPassageRow = {
  status: PassageStatus;
  current_step: string;
  display_name: string | null;
  role_titles: string[] | null;
  role_title_other: string | null;
  entry_text: string | null;
  supports_text: string | null;
  function_text: string | null;
  headline: string | null;
  intro: string | null;
  story_sections: PassageStorySection[] | null;
  completed_at: string | null;
  updated_at: string | null;
};

const STEPS: PassageStep[] = [
  "name",
  "describe",
  "entry",
  "support",
  "function",
  "look",
  "story",
  "complete",
];

/**
 * `role` was the first step's name before Passage opened on a name instead.
 * Migration 096 rewrites stored drafts, but a row read before that migration
 * runs must still resume somewhere real rather than crashing the reducer.
 */
function asStep(value: string): PassageStep {
  if (value === "role") return "describe";
  return STEPS.includes(value as PassageStep) ? (value as PassageStep) : "name";
}

export function rowToPassage(row: MemberPassageRow): MemberPassage {
  const hasInterpretation =
    Boolean(row.headline) ||
    Boolean(row.intro) ||
    (row.story_sections?.length ?? 0) > 0;

  return {
    status: row.status,
    currentStep: asStep(row.current_step),
    displayName: row.display_name,
    roleTitles: row.role_titles ?? [],
    roleTitleOther: row.role_title_other,
    entryText: row.entry_text,
    supportsText: row.supports_text,
    functionText: row.function_text,
    interpretation: hasInterpretation
      ? {
          headline: row.headline ?? "",
          intro: row.intro ?? "",
          storySections: row.story_sections ?? [],
        }
      : null,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}
