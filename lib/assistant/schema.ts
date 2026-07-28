import {
  MOMENTUM_OPTIONS,
  TASK_CATEGORIES,
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
    "actionTitle",
    "actionCategory",
    "actionDueDate",
    "actionMomentum",
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
        "create_track",
        "set_track_momentum",
        "set_track_deadline",
        "navigate",
      ],
    },
    actionLabel: { type: ["string", "null"] },
    actionSummary: { type: ["string", "null"] },
    actionRef: { type: ["string", "null"] },
    actionTitle: { type: ["string", "null"] },
    actionCategory: { type: ["string", "null"] },
    actionDueDate: { type: ["string", "null"] },
    actionMomentum: { type: ["string", "null"] },
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
  "create_track",
  "set_track_momentum",
  "set_track_deadline",
  "navigate",
]);

const CATEGORIES = new Set(TASK_CATEGORIES.map((c) => c.value));
const MOMENTA = new Set(MOMENTUM_OPTIONS.map((m) => m.value));

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
  const title = asString(obj.actionTitle);
  const category = asString(obj.actionCategory);
  const dueDate = validIsoDate(asString(obj.actionDueDate));
  const momentum = asString(obj.actionMomentum);
  const href = asString(obj.actionHref);

  // Ref must exist in the snapshot map when the action targets an existing row.
  if (
    (kind === "complete_task" ||
      kind === "set_track_momentum" ||
      kind === "set_track_deadline") &&
    (!ref || !refs[ref])
  ) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "complete_task" && refs[ref!]?.type !== "task") {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (
    (kind === "set_track_momentum" || kind === "set_track_deadline") &&
    refs[ref!]?.type !== "track"
  ) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "set_track_momentum" && (!momentum || !MOMENTA.has(momentum as never))) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "set_track_deadline" && !dueDate) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "create_task" && !title) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "create_task" && category && !CATEGORIES.has(category as never)) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "create_track" && !title) {
    return { reply, action: null, suggestions, needsDeeperThinking };
  }

  if (kind === "navigate") {
    if (!href || !HREF_RE.test(href)) {
      return { reply, action: null, suggestions, needsDeeperThinking };
    }
    // navigate may use a ref to open a specific track/project
    if (ref && !refs[ref]) {
      return { reply, action: null, suggestions, needsDeeperThinking };
    }
  }

  const action: ProposedAction = {
    kind,
    label,
    summary,
    ref,
    title,
    category,
    dueDate,
    momentum,
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
