import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  REALTIME_TRANSCRIBE_MODEL,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import {
  clientSecretFromPayload,
  transcriptionSessionConfig,
} from "@/lib/dictation/session";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * Mints a short-lived OpenAI Realtime client secret for gpt-live-transcribe.
 * The standard API key never leaves this server route. The client then opens
 * a WebSocket to OpenAI (HTTPS/WSS) instead of WebRTC, so TEMPO Desktop on
 * Windows does not trigger a Defender Firewall prompt.
 */
export async function POST(_req: NextRequest) {
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

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": createHash("sha256")
            .update(user.id)
            .digest("hex"),
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 60 },
          session: transcriptionSessionConfig(REALTIME_TRANSCRIBE_MODEL),
        }),
        cache: "no-store",
      },
    );

    const payload: unknown = await response.json().catch(() => null);
    const clientSecret = clientSecretFromPayload(payload);
    if (!response.ok || !clientSecret) {
      const detail =
        payload && typeof payload === "object" && "error" in payload
          ? JSON.stringify((payload as { error?: unknown }).error)
          : "";
      console.error(
        "[dictation] Realtime session failed:",
        response.status,
        detail.slice(0, 300),
      );
      return NextResponse.json(
        {
          error:
            "Live dictation couldn't connect. TEMPO can still record this as one voice note.",
        },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { clientSecret },
      { status: 200, headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error(
      "[dictation] Realtime session failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error:
          "Live dictation couldn't connect. TEMPO can still record this as one voice note.",
      },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
