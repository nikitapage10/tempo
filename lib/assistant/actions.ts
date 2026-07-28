/**
 * Client-side action allowlist + executors.
 *
 * The route only returns a proposal. Writes go through existing mutations so
 * RLS and React Query invalidation stay as they already are. Nothing here
 * invents a write endpoint.
 */

import type { Momentum, TaskCategory, TrackType } from "@/lib/types";
import type { ProposedAction, RefMap } from "@/lib/assistant/types";
import { createTask, updateTask } from "@/lib/api/tasks";
import { createTrack, updateTrack } from "@/lib/api/tracks";

export type ActionContext = {
  refs: RefMap;
  activeSpaceId: string | null;
  firstStageId: string | null;
  router: { push: (href: string) => void };
  /** Invalidate after direct API calls that skip the mutation hooks. */
  onWrote?: () => void;
};

export type ActionResult = {
  doneLabel: string;
};

const ALLOWED = new Set<ProposedAction["kind"]>([
  "create_task",
  "complete_task",
  "create_track",
  "set_track_momentum",
  "set_track_deadline",
  "navigate",
]);

export function isAllowedAction(kind: string): kind is ProposedAction["kind"] {
  return ALLOWED.has(kind as ProposedAction["kind"]);
}

export async function executeProposedAction(
  action: ProposedAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  if (!isAllowedAction(action.kind)) {
    throw new Error("That action isn't available.");
  }

  switch (action.kind) {
    case "create_task": {
      if (!action.title) throw new Error("Missing task title.");
      await createTask({
        title: action.title,
        category: (action.category as TaskCategory) || "other",
        status: "todo",
        due_date: action.dueDate,
        track_id:
          action.ref && ctx.refs[action.ref]?.type === "track"
            ? ctx.refs[action.ref].id
            : null,
        project_id:
          action.ref && ctx.refs[action.ref]?.type === "project"
            ? ctx.refs[action.ref].id
            : null,
      });
      ctx.onWrote?.();
      return { doneLabel: "Added." };
    }

    case "complete_task": {
      const entry = action.ref ? ctx.refs[action.ref] : null;
      if (!entry || entry.type !== "task") {
        throw new Error("Couldn't find that task.");
      }
      await updateTask(entry.id, { status: "done" });
      ctx.onWrote?.();
      return { doneLabel: "Marked done." };
    }

    case "create_track": {
      if (!action.title) throw new Error("Missing track title.");
      if (!ctx.activeSpaceId) throw new Error("No active space.");
      await createTrack({
        space_id: ctx.activeSpaceId,
        stage_id: ctx.firstStageId,
        title: action.title,
        type: "original" as TrackType,
      });
      ctx.onWrote?.();
      return { doneLabel: "Added." };
    }

    case "set_track_momentum": {
      const entry = action.ref ? ctx.refs[action.ref] : null;
      if (!entry || entry.type !== "track") {
        throw new Error("Couldn't find that track.");
      }
      if (!action.momentum) throw new Error("Missing momentum.");
      await updateTrack(entry.id, {
        momentum: action.momentum as Momentum,
      });
      ctx.onWrote?.();
      return { doneLabel: `Set to ${action.momentum}.` };
    }

    case "set_track_deadline": {
      const entry = action.ref ? ctx.refs[action.ref] : null;
      if (!entry || entry.type !== "track") {
        throw new Error("Couldn't find that track.");
      }
      if (!action.dueDate) throw new Error("Missing deadline.");
      await updateTrack(entry.id, { deadline: action.dueDate });
      ctx.onWrote?.();
      return { doneLabel: "Deadline set." };
    }

    case "navigate": {
      let href = action.href;
      if (action.ref && ctx.refs[action.ref]) {
        const e = ctx.refs[action.ref];
        if (e.type === "track") href = `/track/${e.id}`;
        else if (e.type === "project") href = `/projects/${e.id}`;
        else if (e.type === "task") href = "/tasks";
      }
      if (!href || !href.startsWith("/")) {
        throw new Error("Nowhere to open.");
      }
      ctx.router.push(href);
      return { doneLabel: "Opened." };
    }

    default:
      throw new Error("That action isn't available.");
  }
}
