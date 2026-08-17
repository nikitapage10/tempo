import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tasks page views and closed-out", () => {
  const page = read("app/(app)/tasks/page.tsx");
  const lanes = read("components/tasks/lanes-view.tsx");
  const archive = read("components/tasks/task-done-archive.tsx");
  const buckets = read("lib/tasks/buckets.ts");
  const composer = read("components/tasks/task-composer.tsx");

  it("wires column drag-and-drop and a date prompt in the Lanes view", () => {
    expect(lanes).toContain("DndContext");
    expect(lanes).toContain("TaskRescheduleDialog");
    expect(lanes).toContain("dropNeedsDatePrompt");
    expect(lanes).toContain("DraggableTaskRow");
    expect(lanes).toContain("TASK_BUCKET_MOVE_HINTS");
    expect(lanes).toContain('LayoutGroup id="tempo-tasks"');
    expect(buckets).toContain("Move to this week");
    expect(buckets).toContain("Move to today");
  });

  it("offers Lanes, List, and Timeline views from the page shell", () => {
    expect(page).toContain('"lanes"');
    expect(page).toContain('"list"');
    expect(page).toContain('"timeline"');
    expect(page).toContain("LanesView");
    expect(page).toContain("ListView");
    expect(page).toContain("TimelineView");
  });

  it("keeps completed work in a Closed out filter, not the page title", () => {
    expect(page).toContain("Closed out");
    expect(page).toContain("TaskDoneArchive");
    expect(page).toContain("<Palette /> Categories");
    expect(archive).toContain("checked off in this space");
    expect(archive).toContain("Back to the board");
  });

  it("creates tasks through the AI composer, with typing and dictation both available", () => {
    expect(page).toContain("TaskComposer");
    expect(page).toContain("handleComposerCreate");
    expect(composer).toContain("parseTaskWithAI");
    expect(composer).toContain("parseNaturalTask");
    expect(composer).toContain("useOriginSpeech");
  });

  it("still supports assignment through Team Operations", () => {
    expect(page).toContain("assign.mutateAsync");
    expect(page).toContain("buildTaskAssigneeOptions");
    expect(page).toContain("fetchMyMemberProfile");
    expect(page).not.toContain("Artist owner");
  });
});
