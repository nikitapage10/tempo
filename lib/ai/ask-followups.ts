/**
 * The conversational half of Import Studio.
 *
 * SERVER ONLY. After the artist adds something, this looks at what TEMPO has so
 * far and asks for what's actually missing — the way a person would if you told
 * them "I've got an EP and some edits" and they needed to build you a workspace.
 *
 * Deliberately separate from synthesize-plan.ts: this runs often and must stay
 * cheap and fast, so it returns a couple of short questions and nothing else.
 */

import { IMPORT_MODEL, createOpenAIClient } from "@/lib/ai/openai";

export type Followup = {
  question: string;
  /** One-tap answers where the choice is closed. Empty when it's open-ended. */
  options: string[];
};

const FOLLOWUP_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["observation", "questions", "enoughToProceed"],
  properties: {
    observation: {
      type: "string",
      description:
        "One or two sentences saying what you actually found, so the artist can see you read it — e.g. \"That screenshot lists 12 project folders; looks like 8 separate songs.\" Be concrete and count things where you can.",
    },
    enoughToProceed: {
      type: "boolean",
      description:
        "True when there is enough to draft a useful workspace, even if detail is still missing.",
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options"],
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "0 to 4 one-tap answers. Empty when the answer is open-ended.",
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You help a musician get their existing catalog into TEMPO, a music project manager.

You've been given whatever they've handed over so far. Ask for what's genuinely
missing, like a person who has to build the workspace would.

TEMPO tracks: song titles, whether something is an original / remix / edit / collab /
bootleg, what stage each one is at (idea, writing, production, mixdown, master,
release prep, released), whether it's actively moving, BPM and key, deadlines,
what the next move is, who they're waiting on, what's blocking it, which songs
group into an EP / album / single / edit pack, release dates, and any to-dos.

Rules:
- Start by saying what you actually found, in the observation field, concretely. If they
  sent a screenshot of a folder, say how many songs you can see and name a few.
  This is how they know you read it rather than ignored it.
- Ask AT MOST 3 questions. Fewer is better. One good question beats three vague ones.
- Ask about what would most change the workspace. Missing song titles matter far
  more than a missing BPM.
- Never ask something they already told you.
- Never ask for a BPM or key unless they've shown they care about tracking those.
- Prefer concrete, specific questions: "You mentioned six edits — what are they
  called?" beats "Can you tell me more about your edits?"
- Give one-tap options only when the answer really is a closed set.
- Write like a person in a studio, not a form. Short sentences. No bullet lists.
- Set enoughToProceed true once you could draft something useful, even if you'd
  still like more. Only set it false when what you have is too thin to make a
  workspace from — for example a couple of song titles and nothing else.`;

export async function askFollowups(
  sources: { kind: string; label: string | null; text: string }[],
): Promise<{ observation: string; questions: Followup[]; enoughToProceed: boolean }> {
  const client = createOpenAIClient();

  const material = sources
    .map(
      (s, i) =>
        `--- ${s.kind}${s.label ? ` (${s.label})` : ""} ---\n${s.text.slice(0, 8000)}`,
    )
    .join("\n\n");

  const response = await client.responses.create({
    model: IMPORT_MODEL,
    store: false,
    instructions: SYSTEM_PROMPT,
    input: `Here is everything the artist has given me so far:\n\n${material}\n\nWhat should I ask them?`,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "import_followups",
        schema: FOLLOWUP_SCHEMA,
        strict: true,
      },
    },
  });

  let parsed: { observation?: unknown; questions?: unknown; enoughToProceed?: unknown } = {};
  try {
    parsed = JSON.parse(response.output_text || "{}");
  } catch {
    // A failed follow-up must never block the import — they can just continue.
    return { observation: "", questions: [], enoughToProceed: true };
  }

  const questions: Followup[] = (Array.isArray(parsed.questions) ? parsed.questions : [])
    .map((raw) => {
      const q = raw as Record<string, unknown>;
      const question = typeof q.question === "string" ? q.question.trim() : "";
      if (!question) return null;
      const options = (Array.isArray(q.options) ? q.options : [])
        .filter((o): o is string => typeof o === "string" && o.trim() !== "")
        .slice(0, 4);
      return { question, options };
    })
    .filter((q): q is Followup => q !== null)
    .slice(0, 3);

  return {
    observation: typeof parsed.observation === "string" ? parsed.observation.trim() : "",
    questions,
    enoughToProceed: parsed.enoughToProceed !== false,
  };
}
