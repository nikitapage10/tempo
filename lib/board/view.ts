export const BOARD_FOCUS_COUNT = 3;

export function clampBoardFocusStart(stageCount: number, requested: number) {
  return Math.max(0, Math.min(Math.max(0, stageCount - BOARD_FOCUS_COUNT), requested));
}

export function focusStartForStage(
  stageCount: number,
  currentStart: number,
  stageIndex: number
) {
  const start = clampBoardFocusStart(stageCount, currentStart);
  if (stageIndex < start) return clampBoardFocusStart(stageCount, stageIndex);
  if (stageIndex >= start + BOARD_FOCUS_COUNT) {
    return clampBoardFocusStart(
      stageCount,
      stageIndex - BOARD_FOCUS_COUNT + 1
    );
  }
  return start;
}

export function boardFocusGridTemplate(
  stageCount: number,
  focusStart: number
) {
  const start = clampBoardFocusStart(stageCount, focusStart);
  return Array.from({ length: stageCount }, (_, index) =>
    index >= start && index < start + BOARD_FOCUS_COUNT
      ? "minmax(0, 1fr)"
      : "minmax(3rem, 0.0001fr)"
  ).join(" ");
}
