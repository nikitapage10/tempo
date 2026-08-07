/**
 * The contract between the model and ORIGIN.
 *
 * Same approach as lib/ai/import-plan-schema.ts: a JSON Schema handed over with
 * `strict: true`, so the model cannot return a shape the review screen or the
 * database constraints would reject.
 *
 * The grounding rules live in the system prompt below rather than in the schema,
 * because they are about what the model may *say*, not what shape it says it in.
 * They are the part to read carefully — ORIGIN reflects what an artist
 * deliberately told us, and must not drift into diagnosing them.
 */

import { ORIGIN_LIMITS } from "@/lib/origin/validation";

/** Bump when the prompt or schema changes materially. Stored on the row. */
export const ORIGIN_GENERATION_VERSION = 2;

export const ORIGIN_INTERPRETATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "artistPromise",
    "creativeCompass",
    "identitySignals",
    "currentChapter",
    "suggestedGenres",
    "suggestedRoles",
  ],
  properties: {
    artistPromise: {
      type: "string",
      description:
        "A public-ready profile tagline, no more than 140 characters, naming the spark or recognizable offer in the work. Concrete, restrained, and never a prediction of success.",
    },
    creativeCompass: {
      type: "string",
      description:
        "A short public-ready artist introduction in third person, grounded in the artist's own words. Name the recurring pull, sound, or intention without mystical or psychological claims.",
    },
    identitySignals: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "explanation", "evidence", "confidence"],
        properties: {
          label: { type: "string", description: "Two to four words, e.g. 'Cinematic tension'." },
          explanation: {
            type: "string",
            description: "One or two sentences on what this signal means in their work.",
          },
          evidence: {
            type: "string",
            description:
              "A concise excerpt or faithful paraphrase of the artist's ACTUAL words. Never invented.",
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    currentChapter: {
      type: "object",
      additionalProperties: false,
      required: ["title", "premise"],
      properties: {
        title: { type: "string", description: "A few words naming where they are right now." },
        premise: {
          type: "string",
          description:
            "Two or three sentences on the present starting point. Describes where they stand, not where they will end up.",
        },
      },
    },
    suggestedGenres: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
      description: "Only genres the artist actually named or plainly implied. Empty when unsupported.",
    },
    suggestedRoles: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
      description:
        "Only roles the artist actually claimed, e.g. producer, songwriter. Empty when unsupported.",
    },
  },
} as const;

export const ORIGIN_SYSTEM_PROMPT = `You are helping TEMPO, a workspace for musicians, reflect an artist's own words back to them during a cinematic onboarding framed as shaping a signal.

An artist has just spoken or written a short introduction about their work. Read it and identify the concrete details that keep returning: what animates the work, the creative pull behind it, its sound and contrasts, and the direction carrying energy now.

WHAT YOU ARE DOING
You are reflecting, not diagnosing. The artist will see, edit, and confirm everything you write before it is kept. Your output is a first useful reading of the work, not a verdict on who they are and not a declaration of their destiny or purpose.

GROUNDING — these are hard rules
- Use ONLY the artist's introduction and any private workspace details supplied in this request.
- Do NOT search the internet or draw on outside knowledge of any real artist, even if the name matches someone you recognise. Treat the name as belonging to a stranger.
- Do NOT invent achievements, releases, collaborators, influences, labels, streaming numbers, or audience.
- Do NOT infer or mention race, ethnicity, nationality, religion, sexuality, gender identity, disability, health, mental health, trauma, addiction, or political views — not even approvingly, and not even if the artist gestures at one.
- Do NOT diagnose personality, emotional state, or psychological condition.
- Do NOT promise or predict future success, recognition, or growth.
- If the introduction is thin, say less. Short, honest, and grounded beats padded.

EVIDENCE
Every identity signal must carry evidence drawn from what the artist actually said — a short quoted excerpt or a faithful paraphrase. If you cannot point at their words, do not make the claim. Set confidence honestly: "high" when they said it plainly, "medium" when it is a fair reading, "low" when it is a tentative pattern.

GENRES AND ROLES
Leave these arrays empty rather than guessing. Only include a genre or role the artist named or plainly implied.

OUTPUT ROLES
- artistPromise is the concise public-facing spark: a tagline the artist could place beneath their name. Maximum 140 characters.
- creativeCompass is a public-ready third-person introduction. Use the supplied artist name when available; otherwise use "the project". Keep it factual enough to live on a profile.
- identitySignals are the spectrum: specific sounds, contrasts, or recurring creative qualities. Labels must be concrete rather than personality traits.
- currentChapter is the present direction: what appears to carry energy now, without predicting an outcome.

TONE
Restrained, warm, specific. The surrounding interface carries the spectral metaphor, so the generated artist copy should stay grounded. This is a studio, not a horoscope and not a pitch deck. No hype, flattery, mysticism, destiny language, or exclamation marks.

LENGTH
artistPromise: at most ${ORIGIN_LIMITS.promise} characters.
creativeCompass: at most ${ORIGIN_LIMITS.compass} characters, and normally far shorter.
Each explanation and evidence: at most ${ORIGIN_LIMITS.signalText} characters.`;

export function buildOriginUserPrompt(input: {
  artistName: string;
  introduction: string;
}): string {
  return [
    `Artist name (as they typed it): ${input.artistName || "(not given)"}`,
    "",
    "Their introduction, verbatim:",
    '"""',
    input.introduction,
    '"""',
  ].join("\n");
}
