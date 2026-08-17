import type * as React from "react";

export type TaskCategoryDefinition = {
  key: string;
  label: string;
  color: string;
  sort: number;
  locked: boolean;
};

export const DEFAULT_TASK_CATEGORIES: TaskCategoryDefinition[] = [
  { key: "social", label: "Social", color: "#ec4899", sort: 10, locked: true },
  { key: "outreach", label: "Outreach", color: "#38bdf8", sort: 20, locked: true },
  { key: "pitching", label: "Pitching", color: "#fb7185", sort: 30, locked: true },
  { key: "admin", label: "Admin", color: "#f59e0b", sort: 40, locked: true },
  { key: "production", label: "Production", color: "#9d8cff", sort: 50, locked: true },
  { key: "other", label: "Other", color: "#8b8b96", sort: 60, locked: true },
];

export function normalizeTaskCategoryColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#8b8b96";
}

export function mergeTaskCategories(saved: TaskCategoryDefinition[]) {
  const merged = new Map(DEFAULT_TASK_CATEGORIES.map((category) => [category.key, category]));
  for (const category of saved) {
    merged.set(category.key, {
      ...category,
      locked: DEFAULT_TASK_CATEGORIES.some((item) => item.key === category.key),
    });
  }
  return Array.from(merged.values()).sort(
    (a, b) => a.sort - b.sort || a.label.localeCompare(b.label)
  );
}

export function taskCategoryChipStyle(
  category: TaskCategoryDefinition | undefined,
  active = false
): React.CSSProperties | undefined {
  if (!category) return undefined;
  const color = normalizeTaskCategoryColor(category.color);
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} ${active ? 58 : 30}%, var(--line))`,
    backgroundColor: `color-mix(in srgb, ${color} ${active ? 18 : 9}%, var(--bg-2))`,
  };
}

export function taskCategorySurfaceStyle(
  category: TaskCategoryDefinition | undefined
): React.CSSProperties | undefined {
  if (!category) return undefined;
  const color = normalizeTaskCategoryColor(category.color);
  return {
    borderColor: `color-mix(in srgb, ${color} 28%, var(--line))`,
    backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${color} 9%, rgb(var(--bg-1-rgb) / 0.96)), rgb(var(--bg-1-rgb) / 0.96))`,
  };
}
