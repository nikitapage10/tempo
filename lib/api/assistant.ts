/**
 * Client fetch wrapper for the floating assistant.
 */

import type { AssistantAttachment } from "@/lib/assistant/attachments";
import type {
  AssistantReply,
  HistoryMessage,
  ProposedAction,
  RefMap,
} from "@/lib/assistant/types";

export type AssistantRequest = {
  message: string;
  history: HistoryMessage[];
  escalationsUsed: number;
  /** Helps the snapshot label the active space; optional. */
  activeSpaceId?: string | null;
  attachments?: AssistantAttachment[];
};

export type AssistantResponse = AssistantReply & {
  error?: string;
};

export async function askAssistant(
  input: AssistantRequest,
): Promise<AssistantResponse> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => null)) as
    | (Partial<AssistantReply> & { error?: string })
    | null;

  if (res.status === 429) {
    return {
      reply:
        data?.error ??
        "You've asked a lot today — the assistant will be back tomorrow.",
      action: null,
      suggestions: [],
      refs: {},
      escalated: false,
      error: data?.error,
    };
  }

  if (res.status === 401) {
    return {
      reply: data?.error ?? "Sign in first.",
      action: null,
      suggestions: [],
      refs: {},
      escalated: false,
      error: data?.error,
    };
  }

  return {
    reply:
      typeof data?.reply === "string" && data.reply.trim()
        ? data.reply
        : "I couldn't get a clear answer just now. Try again in a moment.",
    action: (data?.action as ProposedAction | null) ?? null,
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    refs: (data?.refs as RefMap) ?? {},
    escalated: data?.escalated === true,
  };
}

/** Recorded voice-memo fallback when live transcription cannot connect. */
export async function transcribeAssistantVoice(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/assistant/transcribe", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => null)) as {
    text?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error || "Couldn't hear that recording.");
  }
  if (!data?.text?.trim()) {
    throw new Error("Couldn't hear that recording.");
  }
  return data.text.trim();
}
