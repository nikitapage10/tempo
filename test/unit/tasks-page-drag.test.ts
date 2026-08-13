import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tasks page drag and closed-out", () => {
  const page = read("app/(app)/tasks/page.tsx");
  const archive = read("components/tasks/task-done-archive.tsx");
  const buckets = read("lib/tasks/buckets.ts");

  it("wires column drag-and-drop and a date prompt", () => {
    expect(page).toContain("DndContext");
    expect(page).toContain("TaskRescheduleDialog");
    expect(page).toContain("dropNeedsDatePrompt");
    expect(page).toContain("DraggableTaskRow");
    expect(page).toContain("TASK_BUCKET_MOVE_HINTS");
    expect(buckets).toContain("Move to this week");
    expect(buckets).toContain("Move to today");
  });

  it("keeps completed work in Closed out under the board, not the page title", () => {
    expect(page).toContain("Closed out");
    expect(page).toContain("TaskDoneArchive");
    expect(page).toContain("What you’ve checked off in this space.");
    expect(page).not.toContain("actions={");
    expect(page).not.toContain("grouped.done.length > 0 && statusFilter !== \"todo\"");
    expect(archive).toContain("checked off in this space");
    expect(archive).toContain("Back to the board");
  });
});
