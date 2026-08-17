import type { MemberPassage, PassageStep } from "@/lib/passage/types";

/**
 * Which saved Passage row a visit should resume from.
 *
 * Mirrors Origin: a deliberate Replay ignores the draft so the film runs from
 * Tune in; a Revisit opens the editable closing story; a first-run only
 * resumes an unfinished draft.
 */
export function passageResumeForVisit(
  row: MemberPassage | null,
  opts: { revisit?: boolean; replay?: boolean } = {},
): MemberPassage | null {
  if (opts.replay || !row) return null;
  if (opts.revisit) return { ...row, currentStep: "story" as PassageStep };
  return row.status === "in_progress" ? row : null;
}
