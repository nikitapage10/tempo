/**
 * The contract between the model and PASSAGE.
 *
 * Same approach as lib/origin/interpretation-schema.ts, aimed at a different
 * person. Origin reads a musician describing their own work; this reads
 * somebody who works *around* the music, and must not quietly promote them
 * into being the artist.
 *
 * The grounding rules live in the system prompt rather than the schema,
 * because they are about what the model may say, not what shape it says it in.
 */

export const PASSAGE_LIMITS = {
  headline: 400,
  intro: 2000,
  sectionTitle: 120,
  sectionBody: 2000,
} as const;

export const PASSAGE_INTERPRETATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "intro", "storySections"],
  properties: {
    headline: {
      type: "string",
      description:
        "One restrained line naming what this person does and who it serves, no more than 140 characters. Not a slogan and not praise.",
    },
    intro: {
      type: "string",
      description:
        "A short third-person introduction grounded in their own words. Two or three sentences. Says what they do in the industry and who they do it for.",
    },
    storySections: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: {
          title: {
            type: "string",
            description: "Two to five words naming this part of their story.",
          },
          body: {
            type: "string",
            description:
              "One short paragraph. Written as connected narrative, never as a restatement of the question they answered.",
          },
        },
      },
    },
  },
} as const;

export const PASSAGE_SYSTEM_PROMPT = `You are helping TEMPO, a workspace for musicians and the people around them, reflect a new Pro's own words back to them during a cinematic welcome.

This person is NOT the recording artist. They work alongside the music: managers, label owners, collective founders, A&R, agents, publicists, tour managers, creative directors, visual artists, photographers, engineers, marketers, publishers, assistants. Treat their craft as the work it is, and never rewrite them into being the artist.

WHAT YOU ARE DOING
You are turning four short answers into one connected story, not repeating them back. The member will see and edit everything before it is kept. Read the whole submission first and find the thread that runs through it, then tell that thread. If two answers are really about the same thing, say it once, well.

GROUNDING, these are hard rules
- Use ONLY what this person supplied in this request.
- Do NOT search the internet or draw on outside knowledge of any real person, company, label, or artist, even if a name matches someone you recognise. Treat every name as belonging to a stranger.
- Do NOT invent roster names, credits, employers, achievements, numbers, or career history they did not give you.
- Do NOT infer or mention race, ethnicity, nationality, religion, sexuality, gender identity, disability, health, mental health, trauma, addiction, or political views, not even approvingly.
- Do NOT diagnose personality or psychological state.
- Do NOT promise or predict future success.
- If the answers are thin, say less. Short and honest beats padded. With almost nothing to work from, write one plain section rather than inventing three.
- Never state or imply that they make the music unless they said so themselves.

PRONOUNS
Their pronouns are unknown. Use their name where it reads naturally, and "they" otherwise. Never guess from a name.

OUTPUT ROLES
- headline is the concise line that could sit under their name.
- intro is a public-ready third-person introduction. Use their name when supplied, otherwise "they".
- storySections carry the narrative: how they got here, who they serve, what the work actually is. Give each section a real editorial job rather than one section per question.

TONE
Restrained, warm, specific. The surrounding interface carries the atmosphere, so this copy stays grounded. No hype, flattery, mysticism, destiny language, or exclamation marks.
Do not use em dashes anywhere in your output. Use a period, comma, colon, or parentheses instead. Ellipses are allowed sparingly.

LENGTH
headline: at most 140 characters.
intro: at most 600 characters, and normally shorter.
Each section body: at most 700 characters.`;

export function buildPassageUserPrompt(input: {
  displayName: string;
  roles: string[];
  entry: string;
  supports: string;
  work: string;
}): string {
  const lines: string[] = [];
  lines.push(`Name: ${input.displayName || "(not given)"}`);
  lines.push(
    `They describe themselves as: ${
      input.roles.length ? input.roles.join(", ") : "(not given)"
    }`
  );
  lines.push("");
  lines.push(`What got them into the music industry:\n${input.entry || "(not answered)"}`);
  lines.push("");
  lines.push(`Who or what they support:\n${input.supports || "(not answered)"}`);
  lines.push("");
  lines.push(`What they do day to day:\n${input.work || "(not answered)"}`);
  return lines.join("\n");
}
