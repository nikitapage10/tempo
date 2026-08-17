import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterWorkflowTasks,
  groupWorkflowTasks,
} from "@/lib/tasks/workflow-board";
import type { Task } from "@/lib/types";

const read = (path: string) => readFileSync(resolve(path), "utf8");

function task(partial: Partial<Task> & Pick<Task, "id" | "title" | "status">): Task {
  return {
    user_id: "pro-1",
    track_id: null,
    project_id: null,
    space_id: "space-1",
    category: "other",
    due_date: null,
    notes: null,
    created_at: new Date(0).toISOString(),
    ...partial,
  };
}

describe("Pro workflow board", () => {
  it("keeps tasks in the three professional flow columns", () => {
    const tasks = [
      task({ id: "a", title: "Send pitch", status: "todo" }),
      task({ id: "b", title: "Confirm routing", status: "doing" }),
      task({ id: "c", title: "Archive assets", status: "done" }),
    ];
    const groups = groupWorkflowTasks(tasks);
    expect(groups.todo.map((item) => item.id)).toEqual(["a"]);
    expect(groups.doing.map((item) => item.id)).toEqual(["b"]);
    expect(groups.done.map((item) => item.id)).toEqual(["c"]);
  });

  it("filters the flow by text, category, and project", () => {
    const tasks = [
      task({ id: "a", title: "Send playlist pitch", status: "todo", category: "pitching", project_id: "p-1" }),
      task({ id: "b", title: "Confirm press photos", status: "doing", category: "social", project_id: "p-2", notes: "Campaign assets" }),
    ];
    expect(filterWorkflowTasks(tasks, { query: "campaign", category: "all", projectId: "all" }).map((item) => item.id)).toEqual(["b"]);
    expect(filterWorkflowTasks(tasks, { query: "", category: "pitching", projectId: "p-1" }).map((item) => item.id)).toEqual(["a"]);
  });

  it("renders a Pro task board while preserving the artist song board", () => {
    const route = read("app/(app)/board/page.tsx");
    const board = read("components/board/pro-workflow-board.tsx");
    const shell = read("components/app-shell.tsx");
    expect(route).toContain('mode === "work" ? <ProWorkflowBoard /> : <BoardView />');
    expect(board).toContain("PRO_WORKFLOW_COLUMNS");
    expect(board).toContain("update.mutateAsync");
    expect(board).toContain("data-pro-board");
    expect(shell.slice(shell.indexOf("const WORK_MAIN_NAV"), shell.indexOf("const WORK_MOBILE_NAV"))).toContain('{ href: "/board", label: "Board"');
  });
});
