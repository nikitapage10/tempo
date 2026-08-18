import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("column layout move animation", () => {
  it("shares a layout-move helper instead of a demo Kanban", () => {
    const helper = read("components/ui/layout-item.tsx");
    expect(helper).toContain("useLayoutMove");
    expect(helper).toContain('layout: animate ? ("position" as const) : false');
    expect(helper).toContain("layoutId");
    expect(helper).toContain("useReducedMotion");
    expect(helper).toContain("useLayoutOverflowUnlock");
  });

  it("slides board cards and notes between stages", () => {
    const tracks = read("components/tracks/track-card.tsx");
    const notes = read("components/board/board-note-card.tsx");
    const board = read("components/board/board-view.tsx");
    const column = read("components/board/kanban-column.tsx");
    expect(tracks).toContain('useLayoutMove(`board-track-${track.id}`');
    expect(notes).toContain('useLayoutMove(`board-note-${note.id}`');
    expect(board).toContain('LayoutGroup id="tempo-board"');
    expect(board).toContain("dropAnimation={null}");
    expect(column).toContain("allowOverflow");
  });

  it("slides tasks between due-date columns", () => {
    const row = read("components/tasks/task-row.tsx");
    const lanes = read("components/tasks/lanes-view.tsx");
    expect(row).toContain('layoutId={`task-${props.task.id}`}');
    expect(lanes).toContain('LayoutGroup id="tempo-tasks"');
    expect(lanes).toContain("dropAnimation={null}");
  });

  it("slides Pro workflow cards between stages", () => {
    const board = read("components/board/pro-workflow-board.tsx");
    expect(board).toContain('useLayoutMove(`pro-flow-card-${card.id}`');
    expect(board).toContain('LayoutGroup id="tempo-pro-board"');
    expect(board).toContain("dropAnimation={null}");
    expect(board).toContain("InsertSlot");
    expect(board).toContain("cursor-grab");
  });

  it("uses drop slots and full-card drag on board and tasks", () => {
    const board = read("components/board/board-view.tsx");
    const tracks = read("components/tracks/track-card.tsx");
    const column = read("components/board/kanban-column.tsx");
    const lanes = read("components/tasks/lanes-view.tsx");
    const indicator = read("components/ui/drop-indicator.tsx");
    expect(board).toContain("insertIdBefore");
    expect(board).toContain("slot ?? fromCollision");
    expect(board).toContain("parseDropSlotId");
    expect(tracks).toContain("{ ...listeners, ...attributes }");
    expect(column).toContain("InsertSlot");
    expect(column).toContain("showInsertSlots");
    expect(lanes).toContain("InsertSlot");
    expect(indicator).toContain("absolute inset-x-0");
    expect(indicator).not.toContain("-my-2");
    expect(indicator).not.toContain("if (!show) return null");
  });
});
