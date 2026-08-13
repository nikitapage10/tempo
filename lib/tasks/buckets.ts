import { addDateKey, parseDateKey } from "@/lib/calendar/date";
import type { Task } from "@/lib/types";

export type TaskBucket = "overdue" | "today" | "week" | "later";

export const TASK_BUCKETS: TaskBucket[] = [
  "overdue",
  "today",
  "week",
  "later",
];

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

export function isTaskBucket(value: string): value is TaskBucket {
  return (
    value === "overdue" ||
    value === "today" ||
    value === "week" ||
    value === "later"
  );
}

export function bucketDropId(bucket: TaskBucket): string {
  return `bucket:${bucket}`;
}

export function parseBucketDropId(
  id: string | number | undefined | null
): TaskBucket | null {
  if (id == null) return null;
  const value = String(id);
  if (!value.startsWith("bucket:")) return null;
  const bucket = value.slice(7);
  return isTaskBucket(bucket) ? bucket : null;
}

export function taskDragId(taskId: string): string {
  return `task:${taskId}`;
}

/** Rolling week window: tomorrow through today+6 (today+7 is Later). */
export function weekEndDate(today: string): string {
  return addDateKey(today, 7);
}

export function weekChoiceDates(today: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addDateKey(today, i + 1));
}

export function laterMinDate(today: string): string {
  return addDateKey(today, 7);
}

export function overdueMaxDate(today: string): string {
  return addDateKey(today, -1);
}

export function bucketForDueDate(
  dueDate: string | null,
  today: string
): TaskBucket {
  if (!dueDate) return "later";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  if (dueDate < weekEndDate(today)) return "week";
  return "later";
}

export function bucketForTask(task: Task, today: string): TaskBucket | null {
  if (task.status === "done") return null;
  return bucketForDueDate(task.due_date, today);
}

/** Today is unambiguous; every other column needs a specific date. */
export function dropNeedsDatePrompt(bucket: TaskBucket): boolean {
  return bucket !== "today";
}

export function immediateDueDateForBucket(
  bucket: TaskBucket,
  today: string
): string | null {
  return bucket === "today" ? today : null;
}

export function formatBucketDateLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
