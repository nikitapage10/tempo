export const BOARD_FOCUS_COUNT = 3;

export function clampBoardFocusStart(stageCount: number, requested: number) {
  return Math.max(0, Math.min(Math.max(0, stageCount - BOARD_FOCUS_COUNT), requested));
}

export function focusStartForStage(stageCount: number, stageIndex: number) {
  return clampBoardFocusStart(stageCount, stageIndex - 1);
}
