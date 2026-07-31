import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  ORIGIN_INTERPRETATION_SCHEMA,
  ORIGIN_SYSTEM_PROMPT,
  buildOriginUserPrompt,
} from "@/lib/origin/interpretation-schema";
import {
  MIN_INTRODUCTION_CHARS,
  ORIGIN_LIMITS,
  sanitizeInterpretation,
} from "@/lib/origin/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

/**
 * POST /api/artist-origin/interpret — read an artist's spoken introduction and
 * return a provisional reflection of it.
 *
 * Ownership is checked against the artists table before the model is called, so
 * a guessed artist UUID from another account cannot be used to spend tokens or
 * to have anything written. Nothing here writes to the database: the artist
 * edits the result first, and the review step saves it.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return fail("TEMPO's interpretation isn't switched on right now.", 503);
  }

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return fail("Unsupported request.", 415);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in first.", 401);

  const body = (await req.json().catch(() => null)) as {
    artistId?: unknown;
    artistName?: unknown;
    introduction?: unknown;
  } | null;

  const artistId = typeof body?.artistId === "string" ? body.artistId : "";
  const artistName = typeof body?.artistName === "string" ? body.artistName.trim() : "";
  const introduction =
    typeof body?.introduction === "string" ? body.introduction.trim() : "";

  if (!artistId) return fail("No artist selected.", 400);
  if (introduction.length < MIN_INTRODUCTION_CHARS) {
    return fail("There isn't enough here to read yet.", 422);
  }
  if (introduction.length > ORIGIN_LIMITS.introduction) {
    return fail("That's longer than TEMPO can read in one go.", 413);
  }

  // The caller's own id is never taken from the request body. RLS would also
  // hide another account's artist, but checking explicitly keeps the failure a
  // clean 404 rather than a confusing empty read.
  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (artistError) return fail("Couldn't reach your artist just now.", 502);
  if (!artist) return fail("Artist not found.", 404);

  try {
    const client = createOpenAIClient();
    const completion = await client.chat.completions.create({
      model: IMPORT_MODEL,
      messages: [
        { role: "system", content: ORIGIN_SYSTEM_PROMPT },
        { role: "user", content: buildOriginUserPrompt({ artistName, introduction }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "artist_origin_interpretation",
          strict: true,
          schema: ORIGIN_INTERPRETATION_SCHEMA,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("TEMPO couldn't find the shape of that. Try again.", 502);

    const parsed = JSON.parse(raw) as unknown;
    // Sanitized server-side too: strict mode fixes the shape, not the lengths.
    const interpretation = sanitizeInterpretation(parsed);

    if (!interpretation.artistPromise && interpretation.identitySignals.length === 0) {
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
