import {
  MOMENTUM_OPTIONS,
  PROJECT_TYPES,
  TASK_CATEGORIES,
  TRACK_TYPES,
} from "@/lib/constants";
import type {
  ActionKind,
  ProposedAction,
  RefMap,
} from "@/lib/assistant/types";

/** Strict JSON schema for responses.create structured output. */
export const ASSISTANT_REPLY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "actionKind",
    "actionLabel",
    "actionSummary",
    "actionRef",
    "actionStageRef",
    "actionTitle",
    "actionCategory",
    "actionDueDate",
    "actionMomentum",
    "actionProjectType",
    "actionBpm",
    "actionMusicalKey",
    "actionTrackType",
    "actionHref",
    "suggestions",
    "needsDeeperThinking",
  ],
  properties: {
    reply: {
      type: "string",
      description: "Plain text reply, at most ~700 characters. No markdown.",
    },
    actionKind: {
      type: ["string", "null"],
      enum: [
        null,
        "create_task",
        "complete_task",
        "set_task_due_date",
        "create_track",
        "create_project",
        "move_track_stage",
        "set_track_momentum",
        "set_track_deadline",
        "set_track_next_action",
        "set_track_bpm",
        "set_track_key",
        "set_track_genre",
        "set_track_title",
        "set_track_type",
        "set_track_blocked",
        "set_track_waiting",
        "navigate",
      ],
    },
    actionLabel: { type: ["string", "null"] },
    actionSummary: { type: ["string", "null"] },
    actionRef: { type: ["string", "null"] },
    actionStageRef: {
      type: ["string", "null"],
      description: "Stage short ref (s1, s2) for move_track_stage.",
    },
    actionTitle: { type: ["string", "null"] },
    actionCategory: { type: ["string", "null"] },
    actionDueDate: { type: ["string", "null"] },
    actionMomentum: { type: ["string", "null"] },
    actionProjectType: { type: ["string", "null"] },
    actionBpm: {
      type: ["number", "null"],
      description: "Integer BPM for set_track_bpm (40–300).",
    },
    actionMusicalKey: {
      type: ["string", "null"],
      description: "Musical key for set_track_key, e.g. Am, F# minor.",
    },
    actionTrackType: {
      type: ["string", "null"],
      description: "Track type for set_track_type.",
    },
    actionHref: { type: ["string", "null"] },
    suggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    needsDeeperThinking: { type: "boolean" },
  },
};

const ACTION_KINDS = new Set<ActionKind>([
  "create_task",
  "complete_task",
  "set_task_due_date",
  "create_track",
  "create_project",
  "move_track_stage",
  "set_track_momentum",
  "set_track_deadline",
  "set_track_next_action",
  "set_track_bpm",
  "set_track_key",
  "set_track_genre",
  "set_track_title",
  "set_track_type",
  "set_track_blocked",
  "set_track_waiting",
  "navigate",
]);

const TRACK_EDIT_KINDS = new Set<ActionKind>([
  "set_track_momentum",
  "set_track_deadline",
  "set_track_next_action",
  "set_track_bpm",
  "set_track_key",
  "set_track_genre",
  "set_track_title",
  "set_track_type",
  "set_track_blocked",
  "set_track_waiting",
  "move_track_stage",
]);

const CATEGORIES = new Set(TASK_CATEGORIES.map((c) => c.value));
const MOMENTA = new Set(MOMENTUM_OPTIONS.map((m) => m.value));
const PROJECT_TYPE_SET = new Set(PROJECT_TYPES.map((p) => p.value));
const TRACK_TYPE_SET = new Set(TRACK_TYPES.map((t) => t.value));

const HREF_RE =
  /^\/($|board(\/|$)|tracks(\/|$)|track\/|projects(\/|$)|tasks(\/|$)|import(\/|$)|settings(\/|$))/;

const MAX_REPLY = 700;
const MAX_LABEL = 40;
const MAX_YEARS_OUT = 5;

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function validIsoDate(s: string | null): string | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const max = new Date();
  max.setUTCFullYear(max.getUTCFullYear() + MAX_YEARS_OUT);
  if (d.getTime() > max.getTime()) return null;
  return s;
}

function validBpm(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 40 || n > 300) return null;
  return n;
}

export type ValidatedAssistantOutput = {
  reply: string;
  action: ProposedAction | null;
  suggestions: string[];
  needsDeeperThinking: boolean;
};

/**
 * Re-validate model output the same way validatePlan() does for import —
 * the reply can drive a write proposal, so drop anything shaky.
 */
export function validateAssistantOutput(
  raw: unknown,
  refs: RefMap,
): ValidatedAssistantOutput {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  let reply = asString(obj.reply) ?? "";
  if (reply.length > MAX_REPLY) reply = reply.slice(0, MAX_REPLY);

  const suggestions = (Array.isArray(obj.suggestions) ? obj.suggestions : [])
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim().slice(0, MAX_LABEL))
    .slice(0, 3);

  const needsDeeperThinking = obj.needsDeeperThinking === true;

  const kindRaw = obj.actionKind;
  const kind =
    typeof kindRaw === "string" && ACTION_KINDS.has(kindRaw as ActionKind)
      ? (kindRaw as ActionKind)
      : null;

  if (!kind) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  const label = (asString(obj.actionLabel) ?? "Confirm").slice(0, MAX_LABEL);
  const summary = asString(obj.actionSummary) ?? label;
  const ref = asString(obj.actionRef);
  const stageRef = asString(obj.actionStageRef);
  const title = asString(obj.actionTitle);
  const category = asString(obj.actionCategory);
  const dueDate = validIsoDate(asString(obj.actionDueDate));
  const momentum = asString(obj.actionMomentum);
  const projectType = asString(obj.actionProjectType);
  const bpm = validBpm(obj.actionBpm);
  const musicalKey = asString(obj.actionMusicalKey);
  const trackType = asString(obj.actionTrackType);
  const href = asString(obj.actionHref);

  const drop = () =>
    ({ reply, action: null, suggestions, needsDeeperThinking }) as const;

  if (
    (kind === "complete_task" ||
      kind === "set_task_due_date" ||
      TRACK_EDIT_KINDS.has(kind)) &&
    (!ref || !refs[ref])
  ) {
    return drop();
  }

  if (
    (kind === "complete_task" || kind === "set_task_due_date") &&
    refs[ref!]?.type !== "task"
  ) {
    return drop();
  }

  if (TRACK_EDIT_KINDS.has(kind) && refs[ref!]?.type !== "track") {
    return drop();
  }

  if (kind === "set_track_momentum" && (!momentum || !MOMENTA.has(momentum as never))) {
    return drop();
  }

  if (kind === "set_track_deadline" && !dueDate) {
    return drop();
  }

  if (kind === "set_task_due_date" && !dueDate) {
    return drop();
  }

  if (kind === "set_track_next_action" && !title) {
    return drop();
  }

  if (kind === "set_track_bpm" && bpm == null) {
    return drop();
  }

  if (kind === "set_track_key" && !musicalKey) {
    return drop();
  }

  if (kind === "set_track_genre" && !title) {
    // genre text rides in actionTitle
    return drop();
  }

  if (kind === "set_track_title" && !title) {
    return drop();
  }

  if (kind === "set_track_type" && (!trackType || !TRACK_TYPE_SET.has(trackType as never))) {
    return drop();
  }

  if (kind === "set_track_blocked" && !title) {
    // blocked_reason in actionTitle; empty string not allowed — use "clear" via a clear phrase
    return drop();
  }

  if (kind === "set_track_waiting" && !title) {
    return drop();
  }

  if (kind === "create_task" && !title) {
    return drop();
  }

  if (kind === "create_task" && category && !CATEGORIES.has(category as never)) {
    return drop();
  }

  if (kind === "create_track" && !title) {
    return drop();
  }

  if (kind === "create_project" && !title) {
    return drop();
  }

  if (
    kind === "create_project" &&
    projectType &&
    !PROJECT_TYPE_SET.has(projectType as never)
  ) {
    return drop();
  }

  if (kind === "move_track_stage") {
    if (!stageRef || !refs[stageRef] || refs[stageRef].type !== "stage") {
      return drop();
    }
    const trackSpace = refs[ref!]?.spaceId;
    const stageSpace = refs[stageRef]?.spaceId;
    if (!trackSpace || !stageSpace || trackSpace !== stageSpace) {
      return drop();
    }
  }

  if (kind === "navigate") {
    if (!href || !HREF_RE.test(href)) {
      return drop();
    }
    if (ref && !refs[ref]) {
      return drop();
    }
  }

  const action: ProposedAction = {
    kind,
    label,
    summary,
    ref,
    stageRef: kind === "move_track_stage" ? stageRef : null,
    title,
    category,
    dueDate,
    momentum,
    projectType: kind === "create_project" ? projectType || "general" : null,
    bpm: kind === "set_track_bpm" ? bpm : null,
    musicalKey: kind === "set_track_key" ? musicalKey : null,
    trackType: kind === "set_track_type" ? trackType : null,
    href:
      kind === "navigate"
        ? href
        : ref && refs[ref]
          ? hrefForRef(refs[ref])
          : null,
  };

  return { reply, action, suggestions, needsDeeperThinking };
}

function hrefForRef(entry: RefMap[string]): string | null {
  if (entry.type === "track") return `/track/${entry.id}`;
  if (entry.type === "project") return `/projects/${entry.id}`;
  if (entry.type === "task") return "/tasks";
  return null;
}

export const FALLBACK_REPLY =
  "I couldn't get a clear answer just now. Try again in a moment.";
