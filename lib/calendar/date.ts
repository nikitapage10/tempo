import { eachDayOfInterval, startOfWeek } from "date-fns";
import { addDays, localDateString } from "@/lib/format";

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDateKey(value: string, days: number): string {
  return localDateString(addDays(parseDateKey(value), days));
}

export function monthGridStart(value: string): string {
  const date = parseDateKey(value);
  date.setDate(1);
  const mondayOffset = (date.getDay() + 6) % 7;
  return localDateString(addDays(date, -mondayOffset));
}

export function monthGridDates(value: string): string[] {
  const start = monthGridStart(value);
  return Array.from({ length: 42 }, (_, i) => addDateKey(start, i));
}

export function shiftMonth(value: string, delta: number): string {
  const date = parseDateKey(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  return localDateString(date);
}

export function dateInTimeZone(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function timeInTimeZone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function zoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second"))
  );
  return asUtc - date.getTime();
}

export function zonedLocalToUtc(
  dateKey: string,
  time: string,
  timezone: string
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let result = guess - zoneOffsetMs(new Date(guess), timezone);
  result = guess - zoneOffsetMs(new Date(result), timezone);
  return new Date(result).toISOString();
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatMonthTitle(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatDayHeading(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShortWeekday(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, { weekday: "short" });
}

/** The 7 date keys of the week containing `value`, using date-fns for the week-start math. */
export function weekDates(value: string, weekStartsMonday: boolean): string[] {
  const start = startOfWeek(parseDateKey(value), { weekStartsOn: weekStartsMonday ? 1 : 0 });
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map((date) => localDateString(date));
}

export function shiftWeek(value: string, delta: number, weekStartsMonday: boolean): string {
  const [start] = weekDates(value, weekStartsMonday);
  return addDateKey(start, delta * 7);
}

/** Minutes since local midnight (in `timezone`) for a UTC ISO instant — used to position timed items on the week grid. */
export function minutesFromMidnight(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function durationMinutes(startsAt: string, endsAt: string | null): number {
  if (!endsAt) return 60;
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  return minutes > 0 ? minutes : 60;
}

/** UTC offset for `timezone` at `iso`, formatted like "UTC+1" / "UTC-5:30". */
export function utcOffsetLabel(timezone: string, iso = new Date().toISOString()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(iso));
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC+0";
  return raw.replace("GMT", "UTC");
}

/** A curated list of timezones for the picker — falls back to a fixed set if Intl.supportedValuesOf is unavailable. */
export function commonTimezones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    // Intl's IANA list uses "Etc/UTC", not the "UTC" alias most people expect to see and pick.
    if (supported?.length) return supported.includes("UTC") ? supported : ["UTC", ...supported];
  } catch {
    /* fall through to the static list */
  }
  return [
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

