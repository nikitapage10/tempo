/**
 * OpenAI client — SERVER ONLY.
 *
 * Guarded the same way as lib/supabase/admin.ts: a runtime throw if this ever
 * gets pulled into a browser bundle. OPENAI_API_KEY must never appear in a
 * NEXT_PUBLIC_ variable, a client component, a log line, or an error returned
 * to the browser.
 */

import OpenAI from "openai";

/**
 * Model used for reading source material and drafting the import plan.
 * Needs vision (screenshots) plus structured outputs.
 *
 * Terra is the intelligence/cost balance of the 5.6 family — an import runs a
 * handful of times per artist, but a screenshot-heavy one is a lot of tokens.
 * Set OPENAI_IMPORT_MODEL=gpt-5.6-sol for the frontier model on messier
 * catalogs, or gpt-5.6-luna to keep spend down.
 */
export const IMPORT_MODEL = process.env.OPENAI_IMPORT_MODEL || "gpt-5.6-terra";

/**
 * The floating assistant answers many short questions per session, so it runs
 * on the cheap end of the 5.6 family. Luna handles "how do I share a bounce"
 * and "what's overdue" from a prefilled snapshot without breaking a sweat.
 */
export const ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-5.6-luna";

/** Only for turns Luna itself flags as beyond it. Capped per conversation. */
export const ASSISTANT_DEEP_MODEL =
  process.env.OPENAI_ASSISTANT_DEEP_MODEL || "gpt-5.6-terra";

export const ASSISTANT_DAILY_MESSAGES = 60;
export const ASSISTANT_DAILY_ESCALATIONS = 10;

/** Voice memos. 25 MB cap per request on this endpoint. */
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";

/** Continuous microphone dictation over the Realtime transcription API. */
export const REALTIME_TRANSCRIBE_MODEL =
  process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL || "gpt-live-transcribe";

/** Voice notes larger than this can't be transcribed in one request. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

let cached: OpenAI | null = null;

export function createOpenAIClient(): OpenAI {
  if (typeof window !== "undefined") {
    throw new Error("OpenAI client cannot run in the browser.");
  }

  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Server configuration incomplete.");
  }

  cached = new OpenAI({ apiKey, maxRetries: 2 });
  return cached;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Never let a provider error reach the browser verbatim — they can echo request
 * bodies and headers. Log the detail server-side, return something a musician
 * can act on.
 */
export function friendlyAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  console.error("[import] OpenAI call failed:", raw);

  if (/rate limit|429/i.test(raw)) {
    return "TEMPO is being rate-limited right now. Wait a minute and try again.";
  }
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return "That took too long to process. Try again, or split it into fewer items.";
  }
  if (/api key|401|invalid_api_key/i.test(raw)) {
    return "TEMPO's AI connection isn't set up. Check the server configuration.";
  }
  if (/quota|billing|insufficient_quota/i.test(raw)) {
    return "The AI account is out of credit. Top it up and try again.";
  }
  return "Something went wrong reading that. Try again, or remove the item that might be causing it.";
}
