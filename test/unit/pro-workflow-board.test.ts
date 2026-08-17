import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { workflowSeedsForRoles } from "@/lib/pro-workflows/templates";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Pro workflow board", () => {
  it("turns Passage roles into relevant workflow starting points", () => {
    expect(workflowSeedsForRoles(["Manager", "A&R"]).map((seed) => seed.key)).toEqual([
      "management",
      "anr",
    ]);
    expect(workflowSeedsForRoles(["Publicist / PR"])[0].key).toBe("publicity");
    expect(workflowSeedsForRoles(["Tour manager"])[0].key).toBe("touring");
    expect(workflowSeedsForRoles(["Something entirely custom"])[0].key).toBe("operations");
  });

  it("deduplicates related roles and limits a mixed-role home to three ideas", () => {
    expect(
      workflowSeedsForRoles([
        "Creative director",
        "Visual artist / designer",
        "Manager",
        "A&R",
        "Booking agent",
      ]).map((seed) => seed.key)
    ).toEqual(["creative", "management", "anr"]);
  });

  it("uses dedicated workflow cards instead of presenting tasks as a Kanban", () => {
    const route = read("app/(app)/board/page.tsx");
    const board = read("components/board/pro-workflow-board.tsx");
    const api = read("lib/api/pro-workflows.ts");
    expect(route).toContain('mode === "work" ? <ProWorkflowBoard /> : <BoardView />');
    expect(board).toContain("BoardStageSlot");
    expect(board).toContain("data-pro-workflow-board");
    expect(board).toContain("Tasks stay in Tasks");
    expect(board).not.toContain("useTasks(");
    expect(api).toContain('from("pro_workflow_cards")');
  });

  it("keeps role defaults customizable and one-time", () => {
    const board = read("components/board/pro-workflow-board.tsx");
    const migration = read("migrations/109_pro_workflow_boards.sql");
    expect(board).toContain("These are ideas, not rules");
    expect(board).toContain("Customize this workflow");
    expect(migration).toContain("pro_workflow_preferences");
    expect(migration).toContain("initialized_at");
  });
});
