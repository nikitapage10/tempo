import type { ScheduleParseResult } from "@/lib/calendar/schedule-schema";

/**
 * Asks the server to parse a scheduling phrase with the assistant model.
 * Throws on any failure (not configured, network, malformed) so callers can
 * fall back to the local regex parser — this is a "smarter when available"
 * enhancement, never a hard dependency.
 */
export async function parseScheduleWithAI(input: {
  text: string;
  today: string;
  timezone: string;
}): Promise<ScheduleParseResult> {
  const res = await fetch("/api/calendar/parse-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as (ScheduleParseResult & { error?: string }) | null;
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error || "Couldn't reach the scheduling assistant.");
  }
  return data;
}
