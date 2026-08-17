import { addDateKey, parseDateKey } from "@/lib/calendar/date";
import type { TaskParseResult } from "@/lib/tasks/task-schema";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Hand-rolled fallback for the task composer — runs instantly when the
 * assistant model call fails or isn't configured. Understands weekday names,
 * "tomorrow", "in N days", urgency words, #category, @person, and "every X".
 */
export function parseNaturalTask(value: string, today: string): TaskParseResult {
  const lower = value.toLowerCase();

  let dueDate: string | null = null;
  if (lower.includes("tomorrow")) dueDate = addDateKey(today, 1);
  else if (lower.includes("today")) dueDate = today;
  else {
    const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDays) dueDate = addDateKey(today, Number(inDays[1]));
    else {
      const match = WEEKDAYS.findIndex((day) => lower.includes(day));
      if (match >= 0) {
        const current = parseDateKey(today).getDay();
        dueDate = addDateKey(today, ((match - current + 7) % 7) || 7);
      }
    }
  }

  let priority: TaskParseResult["priority"] = 0;
  if (/\burgent\b|\basap\b|!!!/.test(lower)) priority = 3;
  else if (/\bhigh priority\b|\bimportant\b|!!/.test(lower)) priority = 2;
  else if (/\blow priority\b|\bwhenever\b/.test(lower)) priority = 1;

  let recurrence: TaskParseResult["recurrence"] = null;
  if (/\bevery day\b|\bdaily\b/.test(lower)) recurrence = "daily";
  else if (/\bevery week\b|\bweekly\b|\bevery (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(lower))
    recurrence = "weekly";
  else if (/\bevery other week\b|\bbiweekly\b/.test(lower)) recurrence = "biweekly";
  else if (/\bevery month\b|\bmonthly\b/.test(lower)) recurrence = "monthly";

  const reminderMinutes: number[] = [];
  if (/\bremind\b|\balert\b/.test(lower)) {
    if (/\ba (day|24 hours?) before\b|\bone day before\b/.test(lower)) reminderMinutes.push(1440);
    else if (/\ba week before\b|\bone week before\b/.test(lower)) reminderMinutes.push(10080);
    else if (/\ban hour before\b|\bone hour before\b/.test(lower)) reminderMinutes.push(60);
    else if (/\b15 min(ute)?s? before\b|\b30 min(ute)?s? before\b/.test(lower))
      reminderMinutes.push(lower.includes("30") ? 30 : 15);
    else reminderMinutes.push(60);
  }

  const assigneeMatch = value.match(/@([a-z][a-z' -]{1,40})/i);
  const assigneeName = assigneeMatch ? assigneeMatch[1].trim() : null;

  const categoryMatch = value.match(/#([a-z0-9_]{2,40})/i);
  const category = categoryMatch ? categoryMatch[1].toLowerCase() : "other";

  const title = value
    .replace(/@[a-z][a-z' -]{1,40}/gi, "")
    .replace(/#[a-z0-9_]{2,40}/gi, "")
    .replace(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(/\bin\s+\d+\s+days?\b/gi, "")
    .replace(/\burgent\b|\basap\b|!!!|\bhigh priority\b|\bimportant\b|!!|\blow priority\b|\bwhenever\b/gi, "")
    .replace(/\bevery (day|week|other week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b|\bdaily\b|\bweekly\b|\bbiweekly\b|\bmonthly\b/gi, "")
    .replace(/\bremind me\b|\balert me\b|\ba (day|24 hours?|week|hour) before\b|\bone (day|week|hour) before\b|\b\d+ min(ute)?s? before\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  return {
    title: title || "New task",
    category,
    dueDate,
    priority,
    assigneeName,
    projectName: null,
    trackName: null,
    steps: [],
    recurrence,
    reminderMinutes,
    notes: null,
  };
}
