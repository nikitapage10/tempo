import { NextResponse, type NextRequest } from "next/server";
import {
  ASSISTANT_DAILY_ESCALATIONS,
  ASSISTANT_DAILY_MESSAGES,
  ASSISTANT_DEEP_MODEL,
  ASSISTANT_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { buildWorkspaceSnapshot } from "@/lib/assistant/snapshot";
import { buildInput, SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import { MAX_MESSAGE_CHARS } from "@/lib/assistant/types";
import {
  ASSISTANT_REPLY_SCHEMA,
  FALLBACK_REPLY,
  validateAssistantOutput,
} from "@/lib/assistant/schema";
import type { HistoryMessage, RefMap } from "@/lib/assistant/types";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function ok(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

type UsageRow = { messages: number; escalations: number };

async function readUsage(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<UsageRow> {
  const { data, error } = await supabase
    .from("assistant_usage")
    .select("messages, escalations")
    .eq("user_id", userId)
    .eq("day", utcDay())
    .maybeSingle();

  if (error) {
    // Table missing until migration 016 is run — treat as empty so the panel
    // still works, and log so it's obvious.
    console.error("[assistant] usage read failed:", error.message);
    return { messages: 0, escalations: 0 };
  }
  return {
    messages: data?.messages ?? 0,
    escalations: data?.escalations ?? 0,
  };
}

async function writeUsage(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  next: UsageRow,
): Promise<void> {
  const { error } = await supabase.from("assistant_usage").upsert(
    {
      user_id: userId,
      day: utcDay(),
      messages: next.messages,
      escalations: next.escalations,
    },
    { onConflict: "user_id,day" },
  );
  if (error) {
    console.error("[assistant] usage write failed:", error.message);
  }
}

async function callModel(
  model: string,
  input: string,
  effort: "minimal" | "low",
): Promise<{ text: string; inputTokens: number; cachedTokens: number }> {
  const client = createOpenAIClient();
  const response = await client.responses.create({
    model,
    store: false,
    instructions: SYSTEM_PROMPT,
    input,
    reasoning: { effort },
    text: {
      format: {
        type: "json_schema",
        name: "assistant_reply",
        schema: ASSISTANT_REPLY_SCHEMA,
        strict: true,
      },
    },
  });

  const usage = response.usage as
    | {
        input_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      }
    | undefined;

  console.info(
    "[assistant] model=%s input_tokens=%s cached_tokens=%s",
    response.model || model,
    usage?.input_tokens ?? "?",
    usage?.input_tokens_details?.cached_tokens ?? "?",
  );

  return {
    text: response.output_text ?? "",
    inputTokens: usage?.input_tokens ?? 0,
    cachedTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
  };
}

function parseRaw(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * POST /api/assistant — one cheap model call per turn; rare escalation.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return ok({
      reply: "TEMPO's assistant isn't switched on right now.",
      action: null,
      suggestions: [],
      refs: {},
      escalated: false,
    });
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return ok({ error: "Sign in first." }, 401);
  }

  const payload = await req.json().catch(() => null);
  const message =
    payload && typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) {
    return ok({
      reply: "Say something and I'll help.",
      action: null,
      suggestions: [],
      refs: {},
      escalated: false,
    });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return ok({
      reply: "That message is a bit long — keep it under a thousand characters.",
      action: null,
      suggestions: [],
      refs: {},
      escalated: false,
    });
  }

  const history: HistoryMessage[] = Array.isArray(payload?.history)
    ? payload.history
        .filter(
          (h: unknown): h is HistoryMessage =>
            !!h &&
            typeof h === "object" &&
            ((h as HistoryMessage).role === "artist" ||
              (h as HistoryMessage).role === "tempo") &&
            typeof (h as HistoryMessage).text === "string",
        )
        .map((h: HistoryMessage) => ({
          role: h.role,
          text: String(h.text).slice(0, 600),
        }))
        .slice(-8)
    : [];

  const escalationsUsed =
    typeof payload?.escalationsUsed === "number" && payload.escalationsUsed >= 0
      ? Math.floor(payload.escalationsUsed)
      : 0;

  const activeSpaceId =
    typeof payload?.activeSpaceId === "string" ? payload.activeSpaceId : null;

  const usage = await readUsage(supabase, user.id);
  if (usage.messages >= ASSISTANT_DAILY_MESSAGES) {
    return ok(
      {
        error:
          "You've asked a lot today — the assistant will be back tomorrow.",
      },
      429,
    );
  }

  let refs: RefMap = {};
  let snapshotText = "## Workspace right now\n(unavailable)";
  try {
    const snap = await buildWorkspaceSnapshot(
      supabase,
      user.id,
      activeSpaceId,
    );
    snapshotText = snap.text;
    refs = snap.refs;
  } catch (err) {
    console.error("[assistant] snapshot failed:", err);
  }

  const input = buildInput(snapshotText, history, message);

  try {
    const cheap = await callModel(ASSISTANT_MODEL, input, "minimal");
    let parsed = parseRaw(cheap.text);
    let validated = validateAssistantOutput(parsed, refs);
    let escalated = false;

    const shouldEscalate =
      validated.needsDeeperThinking &&
      validated.reply.trim().length < 40 &&
      escalationsUsed < 2 &&
      usage.escalations < ASSISTANT_DAILY_ESCALATIONS;

    if (shouldEscalate) {
      try {
        const deep = await callModel(ASSISTANT_DEEP_MODEL, input, "low");
        const deepParsed = parseRaw(deep.text);
        const deepValidated = validateAssistantOutput(deepParsed, refs);
        if (deepValidated.reply.trim()) {
          validated = deepValidated;
          escalated = true;
        }
      } catch (err) {
        console.error("[assistant] escalation failed:", friendlyAIError(err));
      }
    }

    await writeUsage(supabase, user.id, {
      messages: usage.messages + 1,
      escalations: usage.escalations + (escalated ? 1 : 0),
    });

    return ok({
      reply: validated.reply || FALLBACK_REPLY,
      action: validated.action,
      suggestions: validated.suggestions,
      refs,
      escalated,
    });
  } catch (err) {
    friendlyAIError(err);
    await writeUsage(supabase, user.id, {
      messages: usage.messages + 1,
      escalations: usage.escalations,
    });
    return ok({
      reply: FALLBACK_REPLY,
      action: null,
      suggestions: [],
      refs,
      escalated: false,
    });
  }
}
