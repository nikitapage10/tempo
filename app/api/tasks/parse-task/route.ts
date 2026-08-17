import { NextResponse, type NextRequest } from "next/server";
import {
  ASSISTANT_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { TASK_PARSE_SCHEMA, type TaskParseResult } from "@/lib/tasks/task-schema";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_INPUT_CHARS = 600;
const MAX_NAMES = 40;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const block of item.content ?? []) {
      if (block.type === "output_text" && typeof block.text === "string") parts.push(block.text);
    }
  }
  return parts.join("");
}

function cleanNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, MAX_NAMES)
    .map((v) => v.trim());
}

/**
 * POST /api/tasks/parse-task — turns "pitch to Sam by Friday, high priority,
 * remind me a day before" (typed or dictated) into a structured task draft.
 * One cheap model call, no conversation state; the client falls back to a
 * local regex parser if this isn't configured or fails.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503, headers: noStoreHeaders() });
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStoreHeaders() });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_INPUT_CHARS) : "";
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  const timezone = typeof body?.timezone === "string" ? body.timezone : "UTC";
  const categories = cleanNames(body?.categories);
  const assignees = cleanNames(body?.assignees);
  const projects = cleanNames(body?.projects);
  const tracks = cleanNames(body?.tracks);
  if (!text || !today) {
    return NextResponse.json({ error: "Missing text or today." }, { status: 400, headers: noStoreHeaders() });
  }

  try {
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model: ASSISTANT_MODEL,
      store: false,
      instructions:
        "You turn a musician's short, casual task note (typed or spoken) into a structured task draft. " +
        `Today is ${today} in timezone ${timezone}. Resolve weekday names ("Friday"), "today"/"tomorrow", and ` +
        "relative phrasing (\"in 3 days\") against that date. If no date is mentioned, leave dueDate null. " +
        `Category keys available: ${categories.length ? categories.join(", ") : "other"}. ` +
        (assignees.length ? `People who can be assigned: ${assignees.join(", ")}. ` : "") +
        (projects.length ? `Existing projects: ${projects.join(", ")}. ` : "") +
        (tracks.length ? `Existing tracks: ${tracks.join(", ")}. ` : "") +
        "Only set assigneeName/projectName/trackName when the speaker's words clearly match one of those lists — " +
        "return the name exactly as given in the list, never invent a new one. " +
        "Strip the date/priority/assignee/project words out of the title so it reads cleanly. Keep the title under 80 characters.",
      input: text,
      reasoning: { effort: "none" },
      text: {
        format: {
          type: "json_schema",
          name: "task_parse",
          schema: TASK_PARSE_SCHEMA,
          strict: true,
        },
      },
    });

    const raw = extractOutputText(response);
    const parsed = JSON.parse(raw) as TaskParseResult;
    if (!parsed?.title) {
      return NextResponse.json({ error: "Couldn't parse that." }, { status: 422, headers: noStoreHeaders() });
    }
    return NextResponse.json(parsed, { headers: noStoreHeaders() });
  } catch (err) {
    return NextResponse.json({ error: friendlyAIError(err) }, { status: 502, headers: noStoreHeaders() });
  }
}
