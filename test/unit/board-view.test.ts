import { describe, expect, it } from "vitest";
import {
  BOARD_FOCUS_COUNT,
  boardFocusGridTemplate,
  clampBoardFocusStart,
  focusStartForStage,
} from "@/lib/board/view";

describe("board focus window", () => {
  it("shows three detailed stages", () => expect(BOARD_FOCUS_COUNT).toBe(3));

  it("keeps the window inside the pipeline", () => {
    expect(clampBoardFocusStart(7, -2)).toBe(0);
    expect(clampBoardFocusStart(7, 99)).toBe(4);
    expect(clampBoardFocusStart(2, 1)).toBe(0);
  });

  it("moves only far enough to reveal a selected minimized stage", () => {
    expect(focusStartForStage(7, 0, 0)).toBe(0);
    expect(focusStartForStage(7, 0, 3)).toBe(1);
    expect(focusStartForStage(7, 1, 4)).toBe(2);
    expect(focusStartForStage(7, 4, 0)).toBe(0);
    expect(focusStartForStage(7, 4, 6)).toBe(4);
  });

  it("builds three fluid columns with compact rails around them", () => {
    expect(boardFocusGridTemplate(7, 1)).toBe(
      "minmax(3rem, 0.0001fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(3rem, 0.0001fr) minmax(3rem, 0.0001fr) minmax(3rem, 0.0001fr)"
    );
  });
});
