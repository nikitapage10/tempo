import { addDateKey } from "@/lib/calendar/date";
import type { TaskRecurrence } from "@/lib/types";

/** Next due date for a recurring task, from the date it was just closed out on. */
export function nextDueDate(recurrence: TaskRecurrence, from: string): string {
  switch (recurrence) {
    case "daily":
      return addDateKey(from, 1);
    case "weekly":
      return addDateKey(from, 7);
    case "biweekly":
      return addDateKey(from, 14);
    case "monthly": {
      const [year, month, day] = from.split("-").map(Number);
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      date.setMonth(date.getMonth() + 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }
}

export function recurrenceExhausted(next: string, until: string | null): boolean {
  return Boolean(until) && next > (until as string);
}

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: "Repeats daily",
  weekly: "Repeats weekly",
  biweekly: "Repeats every 2 weeks",
  monthly: "Repeats monthly",
};
