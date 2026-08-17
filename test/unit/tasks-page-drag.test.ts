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
    expect(page).toContain("<Palette /> Categories");
    expect(page).not.toContain('actions={<Button type="button" onClick={() => setStatusFilter("done")}');
    expect(page).not.toContain("grouped.done.length > 0 && statusFilter !== \"todo\"");
    expect(archive).toContain("checked off in this space");
    expect(archive).toContain("Back to the board");
  });

  it("keeps core task planning fields visible before More details", () => {
    const moreDetails = page.indexOf('{showMore ? "Hide details" : "More details"}');
    expect(moreDetails).toBeGreaterThan(-1);
    expect(page.indexOf('htmlFor="task-status"')).toBeLessThan(moreDetails);
    expect(page.indexOf('htmlFor="task-due"')).toBeLessThan(moreDetails);
    expect(page.indexOf('htmlFor="task-assignee"')).toBeLessThan(moreDetails);
    expect(page.indexOf('htmlFor="task-track"')).toBeGreaterThan(moreDetails);
    expect(page.indexOf('htmlFor="task-project"')).toBeGreaterThan(moreDetails);
    expect(page).toContain("await assign.mutateAsync({ id: task.id, userId: assigneeId })");
    expect(page).toContain("buildTaskAssigneeOptions");
    expect(page).toContain("fetchMyMemberProfile");
    expect(page).not.toContain("Artist owner");
  });
});
