/**
 * The contract between the model and TEMPO.
 *
 * The model is handed this JSON Schema with `strict: true`, so it cannot return
 * a shape we don't expect. Enum values are generated from lib/constants.ts,
 * which means it also can't emit a track type or task category that the
 * database check constraints would reject.
 *
 * Everything the model infers carries its own provenance — which sources it
 * came from, how sure it is, and a one-line plain-English reason — so the
 * review screen can show the artist why TEMPO thinks what it thinks.
 */

import {
  MOMENTUM_OPTIONS,
  PROJECT_TYPES,
  TASK_CATEGORIES,
  TRACK_TYPES,
} from "@/lib/constants";
import type { Momentum, ProjectType, TaskCategory, TrackType } from "@/lib/types";

export type Confidence = "high" | "medium" | "low";

/** How sure TEMPO is about one inferred field, and where it got it. */
export type Inferred<T> = {
  value: T | null;
  confidence: Confidence;
  sourceIds: string[];
  /** User-facing, e.g. "Inferred from the folder 'Mixes'". Never model reasoning. */
  reasoningSummary: string;
};

export type ProposedSpace = {
  ref: string;
  name: string;
  /** Set when this maps onto a space the artist already has. */
  existingId: string | null;
  reasoningSummary: string;
};

export type ProposedTrack = {
  ref: string;
  title: string;
  spaceRef: string;
  projectRef: string | null;
  type: Inferred<TrackType>;
  stageName: Inferred<string>;
  momentum: Inferred<Momentum>;
  artistAlias: Inferred<string>;
  bpm: Inferred<number>;
  musicalKey: Inferred<string>;
  genre: Inferred<string>;
  destination: Inferred<string>;
  deadline: Inferred<string>;
  nextAction: Inferred<string>;
  nextActionDue: Inferred<string>;
  blockedReason: Inferred<string>;
  waitingOn: Inferred<string>;
  tags: string[];
  notes: string | null;
  checklist: string[];
  collaborators: string[];
  /** Overall confidence — decides which review bucket this lands in. */
  confidence: Confidence;
  sourceIds: string[];
  /** True when this looks like something already in the catalog. */
  possibleDuplicateOf: string | null;
};

export type ProposedProject = {
  ref: string;
  name: string;
  spaceRef: string;
  projectType: Inferred<ProjectType>;
  description: string | null;
  deadline: Inferred<string>;
  trackRefs: string[];
  confidence: Confidence;
  sourceIds: string[];
};

export type ProposedTask = {
  ref: string;
  title: string;
  category: Inferred<TaskCategory>;
  dueDate: Inferred<string>;
  notes: string | null;
  trackRef: string | null;
  projectRef: string | null;
  confidence: Confidence;
  sourceIds: string[];
};

export type ImportQuestion = {
  id: string;
  /** e.g. "I found Gravity v7, Gravity FINAL and Gravity FINAL 2." */
  question: string;
  /** One-tap answers. The artist can always type something else instead. */
  options: string[];
  affectedRefs: string[];
};

export type ImportWarning = {
  message: string;
  sourceIds: string[];
};

export type WorkspaceImportPlan = {
  spaces: ProposedSpace[];
  projects: ProposedProject[];
  tracks: ProposedTrack[];
  tasks: ProposedTask[];
  questions: ImportQuestion[];
  warnings: ImportWarning[];
  /** One or two sentences for the artist, e.g. "Found 8 tracks and one EP." */
  overview: string;
};

// ---------- JSON Schema handed to the model ----------

const CONFIDENCE_ENUM = ["high", "medium", "low"];

/**
 * The model emits FLAT values, not the nested Inferred<T> shape above.
 *
 * Asking it to wrap all sixteen track fields in {value, confidence, sourceIds,
 * reasoningSummary} made a single import take minutes and would blow the
 * serverless time limit outright — it's four times the output for information
 * that's the same for every field on a given track. Instead each item carries
 * one confidence, one set of sourceIds, and a short `why`, and the server
 * expands that into Inferred<T> per field (see validatePlan).
 *
 * Strict mode still requires every property in `required` and
 * `additionalProperties: false` throughout; nullability is a union type.
 */
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

export const IMPORT_PLAN_SCHEMA_NAME = "workspace_import_plan";

export const IMPORT_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["spaces", "projects", "tracks", "tasks", "questions", "warnings", "overview"],
  properties: {
    overview: {
      type: "string",
      description: "One or two sentences summarising what was found, for the artist.",
    },
    spaces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "name", "existingId", "reasoningSummary"],
        properties: {
          ref: { type: "string", description: "Short local id, e.g. 's1'." },
          name: { type: "string" },
          existingId: {
            ...nullableString,
            description:
              "The id of one of the artist's existing spaces when this maps onto it. Strongly prefer reusing an existing space over inventing a new one.",
          },
          reasoningSummary: { type: "string" },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ref", "name", "spaceRef", "projectType", "description",
          "deadline", "trackRefs", "confidence", "sourceIds", "why",
        ],
        properties: {
          ref: { type: "string" },
          name: { type: "string" },
          spaceRef: { type: "string" },
          projectType: {
            type: ["string", "null"],
            enum: [...PROJECT_TYPES.map((p) => p.value), null],
          },
          description: nullableString,
          deadline: { ...nullableString, description: "YYYY-MM-DD" },
          trackRefs: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: CONFIDENCE_ENUM },
          sourceIds: { type: "array", items: { type: "string" } },
          why: { type: "string", description: "One short line the artist will read." },
        },
      },
    },
    tracks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ref", "title", "spaceRef", "projectRef", "type", "stageName",
          "momentum", "artistAlias", "bpm", "musicalKey", "genre", "destination",
          "deadline", "nextAction", "nextActionDue", "blockedReason", "waitingOn",
          "tags", "notes", "checklist", "collaborators", "confidence",
          "sourceIds", "possibleDuplicateOf", "why",
        ],
        properties: {
          ref: { type: "string" },
          title: { type: "string" },
          spaceRef: { type: "string" },
          projectRef: nullableString,
          type: {
            type: ["string", "null"],
            enum: [...TRACK_TYPES.map((t) => t.value), null],
          },
          stageName: {
            ...nullableString,
            description:
              "Must exactly match one of the stage names available in the chosen space.",
          },
          momentum: {
            type: ["string", "null"],
            enum: [...MOMENTUM_OPTIONS.map((m) => m.value), null],
          },
          artistAlias: nullableString,
          bpm: nullableNumber,
          musicalKey: nullableString,
          genre: nullableString,
          destination: {
            ...nullableString,
            description: "Label, distributor, or where it's headed.",
          },
          deadline: { ...nullableString, description: "YYYY-MM-DD" },
          nextAction: nullableString,
          nextActionDue: { ...nullableString, description: "YYYY-MM-DD" },
          blockedReason: nullableString,
          waitingOn: {
            ...nullableString,
            description: "A person's name, when the artist is waiting on someone.",
          },
          tags: { type: "array", items: { type: "string" } },
          notes: nullableString,
          checklist: {
            type: "array",
            items: { type: "string" },
            description: "Only when the source material actually implies concrete to-dos.",
          },
          collaborators: {
            type: "array",
            items: { type: "string" },
            description:
              "Names mentioned as featuring/collaborating. Recorded as notes only — never guess songwriting credit or ownership.",
          },
          confidence: { type: "string", enum: CONFIDENCE_ENUM },
          sourceIds: { type: "array", items: { type: "string" } },
          possibleDuplicateOf: {
            ...nullableString,
            description:
              "The exact title of an existing track when this looks like the same song.",
          },
          why: {
            type: "string",
            description:
              "One short plain-English line the artist will read, e.g. \"From the folder 'Mixes'\". Never expose internal reasoning.",
          },
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ref", "title", "category", "dueDate", "notes",
          "trackRef", "projectRef", "confidence", "sourceIds", "why",
        ],
        properties: {
          ref: { type: "string" },
          title: { type: "string" },
          category: {
            type: ["string", "null"],
            enum: [...TASK_CATEGORIES.map((c) => c.value), null],
          },
          dueDate: { ...nullableString, description: "YYYY-MM-DD" },
          notes: nullableString,
          trackRef: nullableString,
          projectRef: nullableString,
          confidence: { type: "string", enum: CONFIDENCE_ENUM },
          sourceIds: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
      },
    },
    questions: {
      type: "array",
      description:
        "Only ask what materially changes the resulting workspace. Never a generic questionnaire.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "options", "affectedRefs"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          affectedRefs: { type: "array", items: { type: "string" } },
        },
      },
    },
    warnings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["message", "sourceIds"],
        properties: {
          message: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
