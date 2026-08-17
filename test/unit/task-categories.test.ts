import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_CATEGORIES,
  mergeTaskCategories,
  normalizeTaskCategoryColor,
} from "@/lib/tasks/categories";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("custom task categories", () => {
  it("keeps built-ins while applying shared overrides and custom categories", () => {
    const categories = mergeTaskCategories([
      { key: "admin", label: "Operations", color: "#123456", sort: 40, locked: false },
      { key: "custom_approvals", label: "Approvals", color: "#abcdef", sort: 100, locked: false },
    ]);
    expect(categories.find((item) => item.key === "admin")).toMatchObject({
      label: "Operations",
      color: "#123456",
      locked: true,
    });
    expect(categories.find((item) => item.key === "custom_approvals")).toMatchObject({
      label: "Approvals",
      locked: false,
    });
    expect(categories).toHaveLength(DEFAULT_TASK_CATEGORIES.length + 1);
    expect(normalizeTaskCategoryColor("NOPE")).toBe("#8b8b96");
  });

  it("ships additive shared storage and relaxes the task category key safely", () => {
    const path = "migrations/108_custom_task_categories.sql";
    expect(existsSync(resolve(path))).toBe(true);
    const migration = read(path);
    expect(migration).toContain("create table if not exists task_categories");
    expect(migration).toContain("can_read_artist_area(artist_id, 'tasks')");
    expect(migration).toContain("can_write_artist_area(artist_id, 'tasks')");
    expect(migration).toContain("tasks_category_key_shape");
    expect(migration).not.toMatch(/\b(drop\s+table|truncate|reset\s+database)\b/i);
  });

  it("offers category management and uses the palette across task surfaces", () => {
    const manager = read("components/tasks/task-category-manager.tsx");
    const taskRow = read("components/tasks/task-row.tsx");
    const board = read("components/board/pro-workflow-board.tsx");
    const tasks = read("app/(app)/tasks/page.tsx");
    const shell = read("components/app-shell.tsx");
    const api = read("lib/api/task-categories.ts");
    expect(manager).toContain("Add a category");
    expect(manager).toContain("Existing tasks will move to Other");
    expect(taskRow).toContain("taskCategorySurfaceStyle");
    expect(board).toContain("taskCategoryChipStyle");
    expect(tasks).toContain("<Palette /> Categories");
    expect(shell).toContain("<TaskCategoryProvider");
    expect(api).toContain('.update({ category: "other" })');
  });
});
