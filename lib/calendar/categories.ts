export type CalendarCategoryGroup = "source" | "event";

export type CalendarCategory = {
  key: string;
  label: string;
  color: string;
  group: CalendarCategoryGroup;
  sort: number;
  locked: boolean;
};

export const DEFAULT_CALENDAR_CATEGORIES: CalendarCategory[] = [
  { key: "task_due", label: "Task", color: "#7fb4ff", group: "source", sort: 10, locked: true },
  { key: "track_deadline", label: "Track target", color: "#5eead4", group: "source", sort: 20, locked: true },
  { key: "track_next_action", label: "Next move", color: "#a5b4fc", group: "source", sort: 30, locked: true },
  { key: "project_deadline", label: "Project", color: "#ffb56b", group: "source", sort: 40, locked: true },
  { key: "release_date", label: "Release", color: "#facc15", group: "source", sort: 50, locked: true },
  { key: "pitching_deadline", label: "Pitching", color: "#fb7185", group: "source", sort: 60, locked: true },
  { key: "studio_session", label: "Studio session", color: "#8b5cf6", group: "event", sort: 100, locked: true },
  { key: "meeting", label: "Meeting", color: "#38bdf8", group: "event", sort: 110, locked: true },
  { key: "content", label: "Content", color: "#ec4899", group: "event", sort: 120, locked: true },
  { key: "live_show", label: "Live / show", color: "#ef4444", group: "event", sort: 130, locked: true },
  { key: "personal", label: "Personal", color: "#22c55e", group: "event", sort: 140, locked: true },
  { key: "milestone", label: "Milestone", color: "#f59e0b", group: "event", sort: 150, locked: true },
  { key: "other", label: "Other", color: "#a78bfa", group: "event", sort: 160, locked: true },
];

export function mergeCalendarCategories(saved: CalendarCategory[]) {
  const merged = new Map(DEFAULT_CALENDAR_CATEGORIES.map((category) => [category.key, category]));
  for (const category of saved) {
    const base = merged.get(category.key);
    merged.set(category.key, {
      ...category,
      group: base?.group ?? category.group,
      locked: base?.locked ?? category.locked,
    });
  }
  return Array.from(merged.values()).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

export function categoryKeyForItem(source: string, eventKind?: string | null) {
  return source === "custom_event" ? eventKind || "other" : source;
}

export function normalizeCategoryColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#a78bfa";
}
