import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tasks page drag and closed-out", () => {
  const page = read("app/(app)/tasks/page.tsx");
  const archive = read("components/tasks/task-done-archive.tsx");

  it("wires column drag-and-drop and a date prompt", () => {
    expect(page).toContain("DndContext");
    expect(page).toContain("TaskRescheduleDialog");
    expect(page).toContain("dropNeedsDatePrompt");
    expect(page).toContain("DraggableTaskRow");
  });

  it("keeps completed work in Closed out instead of a board footer", () => {
    expect(page).toContain("Closed out");
    expect(page).toContain("TaskDoneArchive");
    expect(page).not.toContain("grouped.done.length > 0 && statusFilter !== \"todo\"");
    expect(archive).toContain("checked off in this space");
  });
});
