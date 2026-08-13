import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  PASSAGE_INTERPRETATION_SCHEMA,
  PASSAGE_SYSTEM_PROMPT,
  buildPassageUserPrompt,
} from "@/lib/passage/interpretation-schema";
import {
  isEmptyPassageInterpretation,
  sanitizePassageInterpretation,
} from "@/lib/passage/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

const MAX_ANSWER = 4000;

function answer(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_ANSWER) : "";
}

/**
 * POST /api/member-passage/interpret — read a Pro's Passage answers and return
 * a short written story built from them.
 *
 * Scoped to the caller: there is no id in the body to point at somebody else's
 * answers, so this cannot be used to spend tokens on another account or to read
 * one. Nothing here writes to the database. The member edits the result first,
 * and the closing step saves it.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return fail("TEMPO's writing isn't switched on right now.", 503);
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return fail("Unsupported request.", 415);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in first.", 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const displayName = answer(body?.displayName).slice(0, 60);
  const roles = Array.isArray(body?.roles)
    ? (body?.roles as unknown[])
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const entry = answer(body?.entry);
  const supports = answer(body?.supports);
  const work = answer(body?.work);

  // Everything is optional in Passage, so "nothing at all" is a real state and
  // is not an error. It just has nothing to write from.
  if (!entry && !supports && !work && roles.length === 0) {
    return fail("There isn't enough here to write from yet.", 422);
  }

  try {
    const client = createOpenAIClient();
    const completion = await client.chat.completions.create({
      model: IMPORT_MODEL,
      messages: [
        { role: "system", content: PASSAGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildPassageUserPrompt({ displayName, roles, entry, supports, work }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "member_passage_interpretation",
          strict: true,
          schema: PASSAGE_INTERPRETATION_SCHEMA,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("TEMPO couldn't find the shape of that. Try again.", 502);

    // Sanitized server-side too: strict mode fixes the shape, not the lengths.
    const interpretation = sanitizePassageInterpretation(JSON.parse(raw) as unknown);
    if (isEmptyPassageInterpretation(interpretation)) {
      return fail("TEMPO couldn't find the shape of that. Try again.", 502);
    }

    return NextResponse.json(
      {
        interpretation,
        usage: {
          model: completion.model,
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        },
      },
      { headers: noStoreHeaders() }
    );
  } catch (err) {
    return fail(friendlyAIError(err), 502);
  }
}
