import { describe, expect, it } from "vitest";
import { BOARD_FOCUS_COUNT, clampBoardFocusStart, focusStartForStage } from "@/lib/board/view";

describe("board focus window", () => {
  it("shows three detailed stages", () => expect(BOARD_FOCUS_COUNT).toBe(3));

  it("keeps the window inside the pipeline", () => {
    expect(clampBoardFocusStart(7, -2)).toBe(0);
    expect(clampBoardFocusStart(7, 99)).toBe(4);
    expect(clampBoardFocusStart(2, 1)).toBe(0);
  });

  it("centers a selected minimized stage when possible", () => {
    expect(focusStartForStage(7, 0)).toBe(0);
    expect(focusStartForStage(7, 3)).toBe(2);
    expect(focusStartForStage(7, 6)).toBe(4);
  });
});
