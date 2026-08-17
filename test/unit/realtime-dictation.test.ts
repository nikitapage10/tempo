import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  downsampleToRate,
  floatToPcm16,
  pcm16ToBase64,
} from "@/lib/dictation/pcm";
import {
  EMPTY_TRANSCRIPT_STATE,
  orderTranscriptItem,
  transcriptText,
  updateTranscript,
} from "@/lib/dictation/realtime-transcript";
import {
  clientSecretFromPayload,
  transcriptionSessionConfig,
} from "@/lib/dictation/session";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Realtime dictation transcript ordering", () => {
  it("keeps speech turns in conversation order when completions arrive out of order", () => {
    let state = updateTranscript(EMPTY_TRANSCRIPT_STATE, {
      itemId: "turn-2",
      text: "second draft",
      kind: "delta",
    });
    state = updateTranscript(state, {
      itemId: "turn-1",
      text: "First thought",
      kind: "completed",
    });
    state = orderTranscriptItem(state, "turn-2", "turn-1");
    state = updateTranscript(state, {
      itemId: "turn-2",
      text: "second thought.",
      kind: "completed",
      previousItemId: "turn-1",
    });

    expect(transcriptText(state)).toBe("First thought second thought.");
  });

  it("accumulates deltas and replaces them with the final transcript", () => {
    let state = updateTranscript(EMPTY_TRANSCRIPT_STATE, {
      itemId: "turn-1",
      text: "Book the ",
      kind: "delta",
    });
    state = updateTranscript(state, {
      itemId: "turn-1",
      text: "studio",
      kind: "delta",
    });
    expect(transcriptText(state)).toBe("Book the studio");

    state = updateTranscript(state, {
      itemId: "turn-1",
      text: "Book the studio.",
      kind: "completed",
    });
    expect(transcriptText(state)).toBe("Book the studio.");
  });
});

describe("Realtime dictation PCM", () => {
  it("downsamples 48 kHz capture to 24 kHz", () => {
    const input = Float32Array.from([0, 0.5, 1, 0.5, 0, -0.5]);
    const output = downsampleToRate(input, 48_000, 24_000);
    expect(output.length).toBe(3);
    expect(output[0]).toBeCloseTo(0);
    expect(output[1]).toBeCloseTo(1);
  });

  it("encodes clamped PCM16 as base64", () => {
    const pcm = floatToPcm16(Float32Array.from([0, 1, -1, 2]));
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(0x7fff);
    expect(pcm[2]).toBe(-0x8000);
    expect(pcm[3]).toBe(0x7fff);
    expect(pcm16ToBase64(pcm).length).toBeGreaterThan(0);
  });
});

describe("Realtime dictation session minting", () => {
  it("reads a client secret from either documented payload shape", () => {
    expect(clientSecretFromPayload({ value: "ek_abc" })).toBe("ek_abc");
    expect(clientSecretFromPayload({ client_secret: "ek_string" })).toBe(
      "ek_string",
    );
    expect(
      clientSecretFromPayload({ client_secret: { value: "ek_nested" } }),
    ).toBe("ek_nested");
    expect(clientSecretFromPayload({ error: "nope" })).toBeNull();
  });

  it("asks for live transcription with server VAD", () => {
    const minted = transcriptionSessionConfig("gpt-live-transcribe");
    expect(minted.type).toBe("transcription");
    expect(minted.audio.input.transcription.model).toBe("gpt-live-transcribe");
    expect(minted.audio.input.turn_detection.type).toBe("server_vad");
    expect(minted.audio.input.format).toBeUndefined();

    const streaming = transcriptionSessionConfig("gpt-live-transcribe", {
      includeFormat: true,
    });
    expect(streaming.audio.input.format?.rate).toBe(24_000);
  });
});

describe("Realtime dictation wiring", () => {
  it("keeps the API key server-side behind an authenticated client secret", () => {
    const route = read("app/api/assistant/realtime-transcription/route.ts");
    const hook = read("hooks/use-realtime-dictation.ts");
    const session = read("lib/dictation/session.ts");

    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("https://api.openai.com/v1/realtime/client_secrets");
    expect(session).toContain('type: "transcription"');
    expect(session).toContain('type: "server_vad"');
    expect(hook).toContain("new WebSocket(");
    expect(hook).toContain("intent=transcription");
    expect(hook).toContain("tempoDesktop?.dictation");
    expect(hook).toContain("includeFormat: true");
    expect(hook).not.toContain("RTCPeerConnection");
    expect(hook).not.toContain("OPENAI_API_KEY");
  });

  it("opens the live socket from the desktop main process", () => {
    const main = read("electron/main.js");
    const preload = read("electron/preload.js");
    const native = read("electron/openai-realtime-ws.js");
    const bridge = read("lib/desktop/bridge.ts");

    expect(main).toContain("registerDictationIpc");
    expect(main).toContain("dictation:start");
    expect(preload).toContain("dictation:");
    expect(preload).toContain("dictation:start");
    expect(native).toContain("Authorization");
    expect(native).toContain("OpenAI-Beta");
    expect(native).toContain("/v1/realtime?intent=transcription");
    expect(bridge).toContain("dictation?:");
  });

  it("uses one continuous session and one-shot recorded fallback", () => {
    const origin = read("hooks/use-origin-speech.ts");
    const voiceInput = read("components/import/voice-input.tsx");

    expect(origin).toContain("useRealtimeDictation");
    expect(voiceInput).toContain("useRealtimeDictation");
    expect(origin).not.toContain("FIRST_SEGMENT_MS");
    expect(origin).not.toContain("flushSegment");
    expect(voiceInput).not.toContain("SpeechRecognition");
  });

  it("gives the assistant a full-height composer without a cramped scrollbar", () => {
    const panel = read("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("rows={3}");
    expect(panel).toContain("min-h-[4.5rem]");
    expect(panel).toContain("overflow-hidden");
    expect(panel).toContain("shrink-0 border-t");
    expect(panel).not.toContain("flex items-end gap-1 rounded-card");
  });
});
