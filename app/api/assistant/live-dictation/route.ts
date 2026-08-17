import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  REALTIME_TRANSCRIBE_MODEL,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { connectOpenAiRealtime } from "@/lib/dictation/openai-realtime-socket";
import { transcriptionSessionConfig } from "@/lib/dictation/session";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-cache, no-transform",
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

/**
 * Same-origin live-dictation relay. The browser/Electron renderer streams PCM
 * here; this Node route holds the OpenAI WebSocket so TEMPO Desktop never has
 * to handshake with api.openai.com from Chromium.
 */
export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured() || !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "TEMPO's dictation isn't switched on right now." },
      { status: 503 },
    );
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let socket;
  try {
    socket = await connectOpenAiRealtime(process.env.OPENAI_API_KEY, {
      "OpenAI-Safety-Identifier": createHash("sha256")
        .update(user.id)
        .digest("hex"),
    });
  } catch (error) {
    console.error(
      "[dictation] OpenAI socket failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Live dictation couldn't connect." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          socket.close();
        }
      };
      send(": connected\n\n");
      socket.onMessage = (text) => send(`data: ${text}\n\n`);
      socket.onClose = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      socket.sendJson({
        type: "session.update",
        session: transcriptionSessionConfig(REALTIME_TRANSCRIBE_MODEL, {
          includeFormat: true,
        }),
      });
      void consumeClientAudio(req.body, socket);
      req.signal.addEventListener("abort", () => socket.close());
    },
    cancel() {
      socket.close();
    },
  });

  return new Response(stream, { status: 200, headers: noStoreHeaders() });
}

async function consumeClientAudio(
  body: ReadableStream<Uint8Array> | null,
  socket: { sendJson: (payload: string | object) => void; close: () => void },
) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let newline = buf.indexOf("\n");
      while (newline >= 0) {
        const line = buf.slice(0, newline).trim();
        buf = buf.slice(newline + 1);
        if (line) forwardLine(socket, line);
        newline = buf.indexOf("\n");
      }
      if (buf.length > 1024 * 1024) buf = "";
    }
  } catch {
    socket.close();
  }
}

function forwardLine(
  socket: { sendJson: (payload: string | object) => void },
  line: string,
) {
  try {
    const parsed = JSON.parse(line) as { type?: string; audio?: string };
    if (parsed.type === "input_audio_buffer.append" && typeof parsed.audio === "string") {
      socket.sendJson(line);
      return;
    }
    if (parsed.type === "input_audio_buffer.commit") {
      socket.sendJson(line);
    }
  } catch {
    /* ignore a torn line */
  }
}
