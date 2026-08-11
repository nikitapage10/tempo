import { NextResponse, type NextRequest } from "next/server";
import {
  ASSISTANT_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { SCHEDULE_PARSE_SCHEMA, type ScheduleParseResult } from "@/lib/calendar/schedule-schema";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_INPUT_CHARS = 400;

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

/**
 * POST /api/calendar/parse-schedule — turns "studio session Friday at 7pm"
 * (typed or dictated) into a structured event/task draft. One cheap model
 * call, no conversation state; the client falls back to a local regex parser
 * if this isn't configured or fails.
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
  if (!text || !today) {
    return NextResponse.json({ error: "Missing text or today." }, { status: 400, headers: noStoreHeaders() });
  }

  try {
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model: ASSISTANT_MODEL,
      store: false,
      instructions:
        "You turn a musician's short, casual scheduling note (typed or spoken) into a structured calendar draft. " +
        `Today is ${today} in timezone ${timezone}. Resolve weekday names ("Friday"), "today"/"tomorrow", and relative ` +
        "phrasing against that date. If no date is mentioned, use today. If no time is mentioned, leave time null (all-day). " +
        "Strip the date/time/kind words out of the title so it reads cleanly. Keep the title under 80 characters.",
      input: text,
      reasoning: { effort: "none" },
      text: {
        format: {
          type: "json_schema",
          name: "schedule_parse",
          schema: SCHEDULE_PARSE_SCHEMA,
          strict: true,
        },
      },
    });

    const raw = extractOutputText(response);
    const parsed = JSON.parse(raw) as ScheduleParseResult;
    if (!parsed?.title || !parsed?.date) {
      return NextResponse.json({ error: "Couldn't parse that." }, { status: 422, headers: noStoreHeaders() });
    }
    return NextResponse.json(parsed, { headers: noStoreHeaders() });
  } catch (err) {
    return NextResponse.json({ error: friendlyAIError(err) }, { status: 502, headers: noStoreHeaders() });
  }
}
