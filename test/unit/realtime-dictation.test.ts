import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_TRANSCRIPT_STATE,
  orderTranscriptItem,
  transcriptText,
  updateTranscript,
} from "@/lib/dictation/realtime-transcript";

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

describe("Realtime dictation wiring", () => {
  it("keeps the API key server-side behind an authenticated SDP exchange", () => {
    const route = read("app/api/assistant/realtime-transcription/route.ts");
    const hook = read("hooks/use-realtime-dictation.ts");

    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("https://api.openai.com/v1/realtime/calls");
    expect(route).toContain('type: "transcription"');
    expect(route).toContain('type: "server_vad"');
    expect(hook).toContain("new RTCPeerConnection()");
    expect(hook).not.toContain("OPENAI_API_KEY");
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
});
