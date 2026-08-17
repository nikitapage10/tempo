import { TARGET_SAMPLE_RATE } from "@/lib/dictation/pcm";

export const LIVE_TRANSCRIBE_MODEL = "gpt-live-transcribe";

const TRANSCRIPTION_PROMPT =
  "Music workspace dictation. Preserve artist names, collaborator names, song and release titles, BPM, musical keys, and natural punctuation.";

const TRANSCRIPTION_KEYWORDS = [
  "TEMPO",
  "BPM",
  "EP",
  "LP",
  "A&R",
  "mix",
  "master",
  "bounce",
  "stems",
];

export function clientSecretFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as {
    value?: unknown;
    client_secret?: { value?: unknown };
  };
  if (typeof body.value === "string" && body.value.trim()) return body.value;
  if (
    typeof body.client_secret?.value === "string" &&
    body.client_secret.value.trim()
  ) {
    return body.client_secret.value;
  }
  return null;
}

/**
 * Shared gpt-live-transcribe session. Used when minting a client secret and
 * again as session.update after the WebSocket opens.
 */
export function transcriptionSessionConfig(model = LIVE_TRANSCRIBE_MODEL) {
  return {
    type: "transcription" as const,
    audio: {
      input: {
        format: { type: "audio/pcm" as const, rate: TARGET_SAMPLE_RATE },
        noise_reduction: { type: "near_field" as const },
        transcription: {
          model,
          prompt: TRANSCRIPTION_PROMPT,
          keywords: TRANSCRIPTION_KEYWORDS,
          delay: "low" as const,
        },
        turn_detection: {
          type: "server_vad" as const,
          threshold: 0.5,
          prefix_padding_ms: 500,
          silence_duration_ms: 1_000,
        },
      },
    },
  };
}
