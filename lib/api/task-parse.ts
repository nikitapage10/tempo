import type { TaskParseResult } from "@/lib/tasks/task-schema";

/**
 * Asks the server to parse a task phrase with the assistant model. Throws on
 * any failure (not configured, network, malformed) so callers can fall back
 * to the local regex parser — this is a "smarter when available" enhancement,
 * never a hard dependency.
 */
export async function parseTaskWithAI(input: {
  text: string;
  today: string;
  timezone: string;
  categories: string[];
  assignees: string[];
  projects: string[];
  tracks: string[];
}): Promise<TaskParseResult> {
  const res = await fetch("/api/tasks/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as (TaskParseResult & { error?: string }) | null;
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error || "Couldn't reach the task assistant.");
  }
  return data;
}
