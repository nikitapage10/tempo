import { addDateKey, formatDayHeading } from "@/lib/calendar/date";
import type { CalendarItem } from "@/lib/calendar/types";

export const SOURCE_ORDER: Record<CalendarItem["source"], number> = {
  custom_event: 0,
  release_date: 1,
  pitching_deadline: 2,
  task_due: 3,
  track_next_action: 4,
  track_deadline: 5,
  project_deadline: 6,
};

export function sortItems(a: CalendarItem, b: CalendarItem) {
  if (!a.allDay && b.allDay) return -1;
  if (a.allDay && !b.allDay) return 1;
  if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) {
    return a.startsAt.localeCompare(b.startsAt);
  }
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.title.localeCompare(b.title);
}

export function itemIntersectsDay(item: CalendarItem, day: string) {
  return item.date <= day && (item.endDate ?? item.date) >= day;
}

export function shortDateLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDateKey(today, 1)) return "Tomorrow";
  return formatDayHeading(date);
}

export function validDateKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
