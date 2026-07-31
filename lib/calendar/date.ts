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

