import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  REALTIME_TRANSCRIBE_MODEL,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SDP_BYTES = 64 * 1024;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * Exchanges a browser WebRTC offer for an OpenAI Realtime transcription
 * answer. The standard API key never leaves this server route.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "TEMPO's dictation isn't switched on right now." },
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

  const sdp = await req.text().catch(() => "");
  if (!sdp.trim() || new TextEncoder().encode(sdp).byteLength > MAX_SDP_BYTES) {
    return NextResponse.json(
      { error: "That microphone session couldn't be started." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const session = {
    type: "transcription",
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: REALTIME_TRANSCRIBE_MODEL,
          prompt:
            "Music workspace dictation. Preserve artist names, collaborator names, song and release titles, BPM, musical keys, and natural punctuation.",
          keywords: [
            "TEMPO",
            "BPM",
            "EP",
            "LP",
            "A&R",
            "mix",
            "master",
            "bounce",
            "stems",
          ],
          delay: "low",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 500,
          silence_duration_ms: 1_000,
        },
      },
    },
  };

  const body = new FormData();
  body.set("sdp", sdp);
  body.set("session", JSON.stringify(session));

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": createHash("sha256")
          .update(user.id)
          .digest("hex"),
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[dictation] Realtime session failed:", response.status);
      return NextResponse.json(
        { error: "Live dictation couldn't connect. TEMPO can still record this as one voice note." },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return new Response(await response.text(), {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[dictation] Realtime session failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Live dictation couldn't connect. TEMPO can still record this as one voice note." },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
