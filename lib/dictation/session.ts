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
    client_secret?: { value?: unknown } | string;
  };
  if (typeof body.value === "string" && body.value.trim()) return body.value;
  const secret = body.client_secret;
  if (typeof secret === "string" && secret.trim()) return secret;
  if (secret && typeof secret === "object" && typeof secret.value === "string") {
    const nested = secret.value.trim();
    if (nested) return nested;
  }
  return null;
}

/**
 * Shared gpt-live-transcribe session. Used when minting a client secret and
 * again as session.update after the WebSocket opens.
 *
 * No turn_detection: gpt-live-transcribe rejects it outright, and it streams
 * deltas as speech arrives anyway. TEMPO commits the buffer itself on Stop.
 */
export function transcriptionSessionConfig(
  model = LIVE_TRANSCRIBE_MODEL,
  options: { includeFormat?: boolean } = {},
) {
  return {
    type: "transcription" as const,
    audio: {
      input: {
        ...(options.includeFormat
          ? { format: { type: "audio/pcm" as const, rate: TARGET_SAMPLE_RATE } }
          : {}),
        noise_reduction: { type: "near_field" as const },
        transcription: {
          model,
          prompt: TRANSCRIPTION_PROMPT,
          keywords: TRANSCRIPTION_KEYWORDS,
          delay: "low" as const,
        },
      },
    },
  };
}
