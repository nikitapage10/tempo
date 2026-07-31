/**
 * Turns extracted source text into a proposed TEMPO workspace.
 *
 * SERVER ONLY. One model call, constrained by IMPORT_PLAN_SCHEMA, followed by a
 * validation pass that assumes the model got things wrong: enums are coerced to
 * values the database will actually accept, refs that point at nothing are
 * dropped, and duplicate detection is redone here against the real catalog
 * rather than trusted from the model.
 */

import {
  IMPORT_PLAN_SCHEMA,
  IMPORT_PLAN_SCHEMA_NAME,
  type Confidence,
  type ImportQuestion,
  type Inferred,
  type ProposedProject,
  type ProposedSpace,
  type ProposedTask,
  type ProposedTrack,
  type WorkspaceImportPlan,
} from "@/lib/ai/import-plan-schema";
import { IMPORT_MODEL, createOpenAIClient } from "@/lib/ai/openai";
import {
  MOMENTUM_OPTIONS,
  PROJECT_TYPES,
  TASK_CATEGORIES,
  TRACK_TYPES,
} from "@/lib/constants";
import type { Momentum, ProjectType, TaskCategory, TrackType } from "@/lib/types";

export type ExistingSpaceContext = {
  id: string;
  name: string;
  stageNames: string[];
};

export type SynthesizeInput = {
  sources: { id: string; kind: string; label: string | null; text: string }[];
  existingSpaces: ExistingSpaceContext[];
  existingTrackTitles: string[];
  existingProjectNames: string[];
  /** Answers to earlier clarifying questions, fed back in on re-synthesis. */
  answers?: { question: string; answer: string }[];
  today: string;
};

export type SynthesizeResult = {
  plan: WorkspaceImportPlan;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const SYSTEM_PROMPT = `You organise a musician's existing catalog into a TEMPO workspace.

TEMPO models music work as: spaces (top-level workspaces, each with a stage pipeline),
tracks (a song, with a stage and momentum), projects (a work container the artist
defines — a campaign, a release push, related tasks, etc. — NOT one project per
track and NOT required for every song), and tasks (to-dos, optionally linked to a
track or project). A project may hold many tracks, one track, or none. Album / EP /
playlist-style song buckets on the Tracks page are a separate concept from projects.

Your job is to read what the artist gave you and propose a workspace. You are organising
evidence, not inventing a catalog.

Rules:
- Only propose things the source material actually supports. Never invent tracks,
  release dates, collaborators, or strategy to fill things out.
- A standalone song is just a track. Do NOT create a project for it. Never wrap each
  track in its own project (no 1:1 track↔project). Only propose a project when there
  is a real shared container: several tracks the artist clearly ties to one release or
  campaign, a pack of related edits/remixes, or work that needs its own tasks (e.g. a
  social push, an art/visual rollout). A new single with nothing else attached gets
  no project at all.
- Only propose a multi-track project when the artist has actually said so, or the
  material clearly names a shared release/campaign with several tracks under it
  ("EP called Echoes", a folder titled after a release with multiple songs inside).
  Several unrelated new songs sitting in the same space are NOT automatically a
  project — ask if you're not sure whether they belong together, don't default to
  grouping them.
- Strongly prefer slotting tracks into the artist's EXISTING spaces. Only propose a new
  space when the material clearly describes a body of work that fits neither.
- stageName must exactly match a stage that exists in the space you assign the track to.
- Keep track titles exactly as they appear in the source — including "(feat. …)",
  "(ft. …)", "(with …)", and similar. Do not strip those from the title.
- Never guess songwriting credit or ownership. Names that appear as "feat." /
  "ft." / "with" may ALSO be listed in collaborators as a note, but that is in
  addition to keeping them in the title — never instead of it.
- When several filenames look like the same song at different points (v7, FINAL,
  FINAL2, "mix", "master"), treat them as ONE track and raise a question rather
  than creating several tracks.
- But "Instrumental", "Acoustic", "Radio Edit" and similar may be separate
  deliverables. When unsure, ask.
- Set confidence honestly. "low" means the artist should check it. Anything you
  are guessing at belongs at low or medium, not high.
- "why" is read by the artist. One short line, written like a person: "From the
  folder 'EP Echoes'" or "The spreadsheet lists this as out in March". Never
  expose your internal reasoning.
- Leave a field null rather than guessing. Null is the normal answer for most
  fields on most tracks — only fill in what the material actually says.
- Ask at most 8 questions, and only ones that change the resulting workspace.
  Ask MORE when the material was thin or ambiguous, and fewer when it was clear.
  A track you had to guess the stage or type for is worth a question.
- If the artist already has a track with the same title, set possibleDuplicateOf to
  that exact title.
- Dates are YYYY-MM-DD. If a source says "March" with no year, infer from context or
  leave it null — do not fabricate a precise date.
- Do not evaluate whether the music is good. Do not invent a release plan.`;

function buildUserPrompt(input: SynthesizeInput): string {
  const parts: string[] = [];

  parts.push(`Today's date is ${input.today}.`);

  parts.push(
    "\n## The artist's existing workspace\n" +
      (input.existingSpaces.length
        ? input.existingSpaces
            .map((s) => `- Space "${s.name}" (id: ${s.id}) — stages: ${s.stageNames.join(", ")}`)
            .join("\n")
        : "- (none yet)"),
  );

  if (input.existingTrackTitles.length) {
    parts.push(
      `\n## Tracks they already have (do not recreate these)\n${input.existingTrackTitles
        .map((t) => `- ${t}`)
        .join("\n")}`,
    );
  }

  if (input.existingProjectNames.length) {
    parts.push(
      `\n## Projects they already have\n${input.existingProjectNames.map((p) => `- ${p}`).join("\n")}`,
    );
  }

  if (input.answers?.length) {
    parts.push(
      "\n## Answers the artist has already given (treat these as authoritative)\n" +
        input.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n"),
    );
  }

  parts.push("\n## Source material");
  for (const source of input.sources) {
    parts.push(
      `\n### Source ${source.id} — ${source.kind}${source.label ? ` — ${source.label}` : ""}\n${source.text}`,
    );
  }

  parts.push(
    "\nPropose the workspace. Cite the source id(s) each thing came from in sourceIds.",
  );

  return parts.join("\n");
}

// ---------- Validation ----------

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

function asConfidence(value: unknown): Confidence {
  return CONFIDENCES.includes(value as Confidence) ? (value as Confidence) : "low";
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((v): v is string => v !== null);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(value: unknown): string | null {
  const str = asString(value);
  if (!str || !ISO_DATE.test(str)) return null;
  return Number.isNaN(Date.parse(str)) ? null : str;
}

/** Provenance shared by every field on one proposed item. */
type ItemContext = { confidence: Confidence; sourceIds: string[]; why: string };

/**
 * Normalises one field into Inferred<T>.
 *
 * Handles both shapes on purpose. The model emits a flat value (see the note in
 * import-plan-schema.ts) and gets the item's shared provenance attached here.
 * The commit route re-runs this over the plan the artist edited, which is
 * already in Inferred form — so an object with a `value` key is unwrapped
 * instead, and the artist's own edit keeps its confidence.
 */
function inferredOf<T>(
  raw: unknown,
  coerce: (v: unknown) => T | null,
  ctx: ItemContext,
): Inferred<T> {
  const isWrapped =
    raw !== null && typeof raw === "object" && !Array.isArray(raw) && "value" in raw;

  if (isWrapped) {
    const obj = raw as Record<string, unknown>;
    return {
      value: coerce(obj.value),
      confidence: asConfidence(obj.confidence),
      sourceIds: asStringArray(obj.sourceIds),
      reasoningSummary: asString(obj.reasoningSummary) || "",
    };
  }

  const value = coerce(raw);
  return {
    value,
    confidence: ctx.confidence,
    sourceIds: ctx.sourceIds,
    // Only claim a reason where there's actually a value to explain.
    reasoningSummary: value === null ? "" : ctx.why,
  };
}

function enumCoercer<T extends string>(allowed: readonly T[]) {
  return (value: unknown): T | null => {
    const str = asString(value)?.toLowerCase();
    if (!str) return null;
    return (allowed as readonly string[]).includes(str) ? (str as T) : null;
  };
}

const asTrackType = enumCoercer<TrackType>(TRACK_TYPES.map((t) => t.value));
const asMomentum = enumCoercer<Momentum>(MOMENTUM_OPTIONS.map((m) => m.value));
const asProjectType = enumCoercer<ProjectType>(PROJECT_TYPES.map((p) => p.value));
const asTaskCategory = enumCoercer<TaskCategory>(TASK_CATEGORIES.map((c) => c.value));

function asBpm(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(asString(value));
  if (!Number.isFinite(num) || num <= 0 || num > 999) return null;
  return Math.round(num * 10) / 10;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\bfeat\.?\b|\bft\.?\b|\bwith\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Rebuilds the plan from whatever the model returned, dropping anything that
 * doesn't hang together. Refs are re-derived rather than trusted, so a
 * hallucinated projectRef can't produce an orphaned track at commit time.
 */
export function validatePlan(
  raw: unknown,
  context: { existingSpaces: ExistingSpaceContext[]; existingTrackTitles: string[] },
): WorkspaceImportPlan {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const existingSpaceIds = new Set(context.existingSpaces.map((s) => s.id));
  const stagesBySpaceId = new Map(context.existingSpaces.map((s) => [s.id, s.stageNames]));
  const existingTitleMap = new Map(
    context.existingTrackTitles.map((t) => [normalizeTitle(t), t]),
  );

  // --- Spaces ---
  const spaces: ProposedSpace[] = [];
  const spaceRefs = new Set<string>();
  for (const item of Array.isArray(obj.spaces) ? obj.spaces : []) {
    const s = item as Record<string, unknown>;
    const ref = asString(s.ref);
    const name = asString(s.name);
    if (!ref || !name || spaceRefs.has(ref)) continue;

    const existingId = asString(s.existingId);
    spaces.push({
      ref,
      name,
      // Never let the model point at a space id that isn't the artist's.
      existingId: existingId && existingSpaceIds.has(existingId) ? existingId : null,
      reasoningSummary: asString(s.reasoningSummary) || "",
    });
    spaceRefs.add(ref);
  }

  // Everything must land somewhere. If the model proposed no space at all but
  // the artist has one, fall back to their first space.
  if (spaces.length === 0 && context.existingSpaces.length > 0) {
    const first = context.existingSpaces[0];
    spaces.push({
      ref: "space_default",
      name: first.name,
      existingId: first.id,
      reasoningSummary: "Your existing space.",
    });
    spaceRefs.add("space_default");
  }

  const fallbackSpaceRef = spaces[0]?.ref ?? null;
  const spaceByRef = new Map(spaces.map((s) => [s.ref, s]));

  const stageNamesForSpaceRef = (ref: string): string[] => {
    const space = spaceByRef.get(ref);
    if (!space) return [];
    if (space.existingId) return stagesBySpaceId.get(space.existingId) ?? [];
    // New spaces get the standard pipeline (see migration 014).
    return ["Idea", "Writing", "Production", "Mixdown", "Master", "Release Prep", "Released"];
  };

  // --- Projects ---
  const projects: ProposedProject[] = [];
  const projectRefs = new Set<string>();
  for (const item of Array.isArray(obj.projects) ? obj.projects : []) {
    const p = item as Record<string, unknown>;
    const ref = asString(p.ref);
    const name = asString(p.name);
    if (!ref || !name || projectRefs.has(ref)) continue;

    const spaceRef = asString(p.spaceRef);
    const resolvedSpaceRef = spaceRef && spaceRefs.has(spaceRef) ? spaceRef : fallbackSpaceRef;
    if (!resolvedSpaceRef) continue;

    const ctx: ItemContext = {
      confidence: asConfidence(p.confidence),
      sourceIds: asStringArray(p.sourceIds),
      why: asString(p.why) || "",
    };

    projects.push({
      ref,
      name,
      spaceRef: resolvedSpaceRef,
      projectType: inferredOf(p.projectType, asProjectType, ctx),
      description: asString(p.description),
      deadline: inferredOf(p.deadline, asDate, ctx),
      trackRefs: asStringArray(p.trackRefs),
      confidence: ctx.confidence,
      sourceIds: ctx.sourceIds,
    });
    projectRefs.add(ref);
  }

  // --- Tracks ---
  const tracks: ProposedTrack[] = [];
  const trackRefs = new Set<string>();
  const seenTitles = new Set<string>();

  for (const item of Array.isArray(obj.tracks) ? obj.tracks : []) {
    const t = item as Record<string, unknown>;
    const ref = asString(t.ref);
    const title = asString(t.title);
    if (!ref || !title || trackRefs.has(ref)) continue;

    const normalized = normalizeTitle(title);
    // Two proposals for the same song within one import — keep the first.
    if (normalized && seenTitles.has(normalized)) continue;

    const spaceRef = asString(t.spaceRef);
    const resolvedSpaceRef = spaceRef && spaceRefs.has(spaceRef) ? spaceRef : fallbackSpaceRef;
    if (!resolvedSpaceRef) continue;

    const ctx: ItemContext = {
      confidence: asConfidence(t.confidence),
      sourceIds: asStringArray(t.sourceIds),
      why: asString(t.why) || "",
    };

    const projectRef = asString(t.projectRef);
    const stageInferred = inferredOf(t.stageName, asString, ctx);
    const validStages = stageNamesForSpaceRef(resolvedSpaceRef);

    // A stage that doesn't exist in the target space would silently become
    // "no stage" at commit time — surface it as unknown instead.
    if (
      stageInferred.value &&
      !validStages.some((s) => s.toLowerCase() === stageInferred.value!.toLowerCase())
    ) {
      stageInferred.value = null;
      stageInferred.confidence = "low";
      stageInferred.reasoningSummary = "Couldn't match this to a stage in that space.";
    }

    // Redo duplicate detection ourselves rather than trusting the model's answer.
    const duplicateOf = existingTitleMap.get(normalized) ?? null;
    const modelDuplicate = asString(t.possibleDuplicateOf);

    tracks.push({
      ref,
      title,
      spaceRef: resolvedSpaceRef,
      projectRef: projectRef && projectRefs.has(projectRef) ? projectRef : null,
      type: inferredOf(t.type, asTrackType, ctx),
      stageName: stageInferred,
      momentum: inferredOf(t.momentum, asMomentum, ctx),
      artistAlias: inferredOf(t.artistAlias, asString, ctx),
      bpm: inferredOf(t.bpm, asBpm, ctx),
      musicalKey: inferredOf(t.musicalKey, asString, ctx),
      genre: inferredOf(t.genre, asString, ctx),
      destination: inferredOf(t.destination, asString, ctx),
      deadline: inferredOf(t.deadline, asDate, ctx),
      nextAction: inferredOf(t.nextAction, asString, ctx),
      nextActionDue: inferredOf(t.nextActionDue, asDate, ctx),
      blockedReason: inferredOf(t.blockedReason, asString, ctx),
      waitingOn: inferredOf(t.waitingOn, asString, ctx),
      tags: asStringArray(t.tags).slice(0, 12),
      notes: asString(t.notes),
      checklist: asStringArray(t.checklist).slice(0, 25),
      collaborators: asStringArray(t.collaborators).slice(0, 12),
      confidence: ctx.confidence,
      sourceIds: ctx.sourceIds,
      possibleDuplicateOf: duplicateOf ?? modelDuplicate,
    });

    trackRefs.add(ref);
    if (normalized) seenTitles.add(normalized);
  }

  // Projects whose tracks all vanished shouldn't survive either.
  const liveProjects = projects.filter((p) => {
    p.trackRefs = p.trackRefs.filter((r) => trackRefs.has(r));
    return true;
  });

  // --- Tasks ---
  const tasks: ProposedTask[] = [];
  const taskRefs = new Set<string>();
  for (const item of Array.isArray(obj.tasks) ? obj.tasks : []) {
    const k = item as Record<string, unknown>;
    const ref = asString(k.ref);
    const title = asString(k.title);
    if (!ref || !title || taskRefs.has(ref)) continue;

    const trackRef = asString(k.trackRef);
    const projectRef = asString(k.projectRef);
    const ctx: ItemContext = {
      confidence: asConfidence(k.confidence),
      sourceIds: asStringArray(k.sourceIds),
      why: asString(k.why) || "",
    };

    tasks.push({
      ref,
      title,
      category: inferredOf(k.category, asTaskCategory, ctx),
      dueDate: inferredOf(k.dueDate, asDate, ctx),
      notes: asString(k.notes),
      trackRef: trackRef && trackRefs.has(trackRef) ? trackRef : null,
      projectRef: projectRef && projectRefs.has(projectRef) ? projectRef : null,
      confidence: ctx.confidence,
      sourceIds: ctx.sourceIds,
    });
    taskRefs.add(ref);
  }

  // --- Questions & warnings ---
  const questions: ImportQuestion[] = [];
  for (const item of Array.isArray(obj.questions) ? obj.questions : []) {
    const q = item as Record<string, unknown>;
    const question = asString(q.question);
    if (!question) continue;
    questions.push({
      id: asString(q.id) || `q${questions.length + 1}`,
      question,
      options: asStringArray(q.options).slice(0, 5),
      affectedRefs: asStringArray(q.affectedRefs),
    });
    if (questions.length >= 8) break;
  }

  const warnings = (Array.isArray(obj.warnings) ? obj.warnings : [])
    .map((item) => {
      const w = item as Record<string, unknown>;
      const message = asString(w.message);
      return message ? { message, sourceIds: asStringArray(w.sourceIds) } : null;
    })
    .filter((w): w is { message: string; sourceIds: string[] } => w !== null);

  // Drop spaces nothing ended up using, so the confirm screen doesn't promise
  // to create an empty space.
  const usedSpaceRefs = new Set([
    ...tracks.map((t) => t.spaceRef),
    ...liveProjects.map((p) => p.spaceRef),
  ]);

  return {
    spaces: spaces.filter((s) => usedSpaceRefs.has(s.ref)),
    projects: liveProjects,
    tracks,
    tasks,
    questions,
    warnings,
    overview: asString(obj.overview) || "",
  };
}

export async function synthesizePlan(input: SynthesizeInput): Promise<SynthesizeResult> {
  const client = createOpenAIClient();

  const response = await client.responses.create({
    model: IMPORT_MODEL,
    store: false,
    instructions: SYSTEM_PROMPT,
    input: buildUserPrompt(input),
    // This is extraction, not deep reasoning, and the whole thing has to fit in
    // a serverless request. Left on the default the call runs for minutes.
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: IMPORT_PLAN_SCHEMA_NAME,
        schema: IMPORT_PLAN_SCHEMA,
        strict: true,
      },
    },
  });

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(response.output_text || "{}");
  } catch {
    throw new Error("The AI returned something TEMPO couldn't read. Try again.");
  }

  return {
    plan: validatePlan(parsed, {
      existingSpaces: input.existingSpaces,
      existingTrackTitles: input.existingTrackTitles,
    }),
    model: response.model || IMPORT_MODEL,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
