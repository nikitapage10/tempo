import { NextResponse, type NextRequest } from "next/server";
import {
  MAX_TRANSCRIBE_BYTES,
  TRANSCRIBE_MODEL,
  createOpenAIClient,
  friendlyAIError,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * POST /api/assistant/transcribe — voice-memo fallback for browsers without
 * live Web Speech. Same model as Import Studio's voice notes.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "TEMPO's assistant isn't switched on right now." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No recording received." },
      { status: 400, headers: noStoreHeaders() },
    );
  }
  if (file.size > MAX_TRANSCRIBE_BYTES) {
    return NextResponse.json(
      { error: "That recording is too long. Keep it under 25 MB." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const client = createOpenAIClient();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
    });
    const text = (transcription.text || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Nothing could be heard in that recording." },
        { status: 422, headers: noStoreHeaders() },
      );
    }
    return NextResponse.json({ text }, { headers: noStoreHeaders() });
  } catch (err) {
    return NextResponse.json(
      { error: friendlyAIError(err) },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
