/**
 * Client-side action allowlist + executors.
 *
 * The route only returns a proposal. Writes go through existing mutations so
 * RLS and React Query invalidation stay as they already are. Nothing here
 * invents a write endpoint. Deletion is never an assistant action.
 */

import type {
  Momentum,
  ProjectType,
  TaskCategory,
  TrackType,
} from "@/lib/types";
import type { ProposedAction, RefMap } from "@/lib/assistant/types";
import { createProject } from "@/lib/api/projects";
import { createTask, updateTask } from "@/lib/api/tasks";
import { createTrack, moveTrackStage, updateTrack } from "@/lib/api/tracks";
import { createSupportReport } from "@/lib/api/reports";

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
  "create_support_report",
  "navigate",
]);

export function isAllowedAction(kind: string): kind is ProposedAction["kind"] {
  return ALLOWED.has(kind as ProposedAction["kind"]);
}

function requireTrack(
  action: ProposedAction,
  ctx: ActionContext,
): { id: string } {
  const entry = action.ref ? ctx.refs[action.ref] : null;
  if (!entry || entry.type !== "track") {
    throw new Error("Couldn't find that track.");
  }
  return entry;
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

    case "set_task_due_date": {
      const entry = action.ref ? ctx.refs[action.ref] : null;
      if (!entry || entry.type !== "task") {
        throw new Error("Couldn't find that task.");
      }
      if (!action.dueDate) throw new Error("Missing due date.");
      await updateTask(entry.id, { due_date: action.dueDate });
      ctx.onWrote?.();
      return { doneLabel: "Due date set." };
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

    case "create_project": {
      if (!action.title) throw new Error("Missing project name.");
      await createProject({
        name: action.title,
        project_type: (action.projectType as ProjectType) || "general",
        deadline: action.dueDate,
        space_id: ctx.activeSpaceId,
      });
      ctx.onWrote?.();
      return { doneLabel: "Added." };
    }

    case "move_track_stage": {
      const track = requireTrack(action, ctx);
      const stage = action.stageRef ? ctx.refs[action.stageRef] : null;
      if (!stage || stage.type !== "stage") {
        throw new Error("Couldn't find that stage.");
      }
      const trackEntry = ctx.refs[action.ref!];
      if (
        trackEntry?.spaceId &&
        stage.spaceId &&
        trackEntry.spaceId !== stage.spaceId
      ) {
        throw new Error("That stage isn't in the same space as the track.");
      }
      await moveTrackStage(track.id, stage.id);
      ctx.onWrote?.();
      return {
        doneLabel: stage.name ? `Moved to ${stage.name}.` : "Moved.",
      };
    }

    case "set_track_momentum": {
      const track = requireTrack(action, ctx);
      if (!action.momentum) throw new Error("Missing momentum.");
      await updateTrack(track.id, {
        momentum: action.momentum as Momentum,
      });
      ctx.onWrote?.();
      return { doneLabel: `Set to ${action.momentum}.` };
    }

    case "set_track_deadline": {
      const track = requireTrack(action, ctx);
      if (!action.dueDate) throw new Error("Missing deadline.");
      await updateTrack(track.id, { deadline: action.dueDate });
      ctx.onWrote?.();
      return { doneLabel: "Deadline set." };
    }

    case "set_track_next_action": {
      const track = requireTrack(action, ctx);
      if (!action.title) throw new Error("Missing next action.");
      await updateTrack(track.id, {
        next_action: action.title,
        next_action_due: action.dueDate,
      });
      ctx.onWrote?.();
      return { doneLabel: "Next move set." };
    }

    case "set_track_bpm": {
      const track = requireTrack(action, ctx);
      if (action.bpm == null) throw new Error("Missing BPM.");
      await updateTrack(track.id, { bpm: action.bpm });
      ctx.onWrote?.();
      return { doneLabel: `BPM set to ${action.bpm}.` };
    }

    case "set_track_key": {
      const track = requireTrack(action, ctx);
      if (!action.musicalKey) throw new Error("Missing key.");
      await updateTrack(track.id, { musical_key: action.musicalKey });
      ctx.onWrote?.();
      return { doneLabel: `Key set to ${action.musicalKey}.` };
    }

    case "set_track_genre": {
      const track = requireTrack(action, ctx);
      if (!action.title) throw new Error("Missing genre.");
      await updateTrack(track.id, { genre: action.title });
      ctx.onWrote?.();
      return { doneLabel: "Genre set." };
    }

    case "set_track_title": {
      const track = requireTrack(action, ctx);
      if (!action.title) throw new Error("Missing title.");
      await updateTrack(track.id, { title: action.title });
      ctx.onWrote?.();
      return { doneLabel: "Title updated." };
    }

    case "set_track_type": {
      const track = requireTrack(action, ctx);
      if (!action.trackType) throw new Error("Missing type.");
      await updateTrack(track.id, {
        type: action.trackType as TrackType,
      });
      ctx.onWrote?.();
      return { doneLabel: `Type set to ${action.trackType}.` };
    }

    case "set_track_blocked": {
      const track = requireTrack(action, ctx);
      if (!action.title) throw new Error("Missing blocked reason.");
      const cleared = /^(clear|none|n\/a|-)$/i.test(action.title.trim());
      await updateTrack(track.id, {
        blocked_reason: cleared ? null : action.title,
      });
      ctx.onWrote?.();
      return { doneLabel: cleared ? "Blocker cleared." : "Blocker set." };
    }

    case "set_track_waiting": {
      const track = requireTrack(action, ctx);
      if (!action.title) throw new Error("Missing waiting-on.");
      const cleared = /^(clear|none|n\/a|-)$/i.test(action.title.trim());
      await updateTrack(track.id, {
        waiting_on: cleared ? null : action.title,
      });
      ctx.onWrote?.();
      return { doneLabel: cleared ? "Waiting cleared." : "Waiting set." };
    }

    case "create_support_report": {
      if (!action.title) throw new Error("Missing report subject.");
      if (action.category !== "bug" && action.category !== "help" && action.category !== "feedback") {
        throw new Error("Missing report category.");
      }
      await createSupportReport({
        category: action.category,
        subject: action.title,
        details: action.summary,
        source: "assistant",
      });
      ctx.onWrote?.();
      return { doneLabel: "Report sent." };
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
