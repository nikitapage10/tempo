/**
 * SERVER — workspace snapshot for the floating assistant.
 *
 * Built once per request through the artist's own session client so RLS is the
 * authority. Short refs (k1, t3, p2) instead of UUIDs keep tokens down and make
 * hallucinated ids impossible to execute.
 */

import {
  deriveAttentionSignals,
  signalPriority,
} from "@/lib/attention/signals";
import type { RefMap } from "@/lib/assistant/types";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = ReturnType<typeof createClient>;

const TITLE_CAP = 60;
const ATTENTION_CAP = 5;
const TASK_CAP = 6;
const PROJECT_CAP = 6;
const RECENT_CAP = 8;

function clip(s: string, n = TITLE_CAP): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function utcDateParts(now: Date): { date: string; weekday: string } {
  const date = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return { date, weekday };
}

function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(t.getTime())) return null;
  return (t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

function daysBetween(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
}

export type WorkspaceSnapshot = {
  text: string;
  refs: RefMap;
};

/**
 * Compact catalog view for one turn. Empty sections are omitted entirely so a
 * brand-new account stays around six lines.
 */
export async function buildWorkspaceSnapshot(
  supabase: ServerClient,
  userId: string,
  activeSpaceId: string | null,
  now = new Date(),
): Promise<WorkspaceSnapshot> {
  const refs: RefMap = {};
  const lines: string[] = [];
  const { date, weekday } = utcDateParts(now);

  lines.push("## Workspace right now");
  lines.push(`Date: ${date} (${weekday})`);

  const [spacesRes, tracksRes, projectsRes, tasksRes] = await Promise.all([
    supabase.from("spaces").select("id, name, sort").eq("user_id", userId).order("sort"),
    supabase
      .from("tracks")
      .select(
        "id, title, space_id, stage_id, momentum, deadline, next_action, next_action_due, blocked_reason, waiting_on, stage_entered_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("projects")
      .select("id, name, project_type, deadline, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("tasks")
      .select("id, title, category, status, due_date, track_id, project_id")
      .eq("user_id", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(40),
  ]);

  const spaces = spacesRes.data ?? [];
  const tracks = tracksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  const spaceIds = spaces.map((s) => s.id);
  const stagesRes = spaceIds.length
    ? await supabase
        .from("stages")
        .select("id, space_id, name, sort")
        .in("space_id", spaceIds)
        .order("sort")
    : { data: [] as { id: string; space_id: string; name: string; sort: number }[] };

  const stages = stagesRes.data ?? [];
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const stagesBySpace = new Map<
    string,
    { id: string; name: string; sort: number }[]
  >();
  for (const stage of stages) {
    const list = stagesBySpace.get(stage.space_id) ?? [];
    list.push({ id: stage.id, name: stage.name, sort: stage.sort });
    stagesBySpace.set(stage.space_id, list);
  }

  const active =
    spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null;
  const others = spaces.filter((s) => s.id !== active?.id);

  // Stage refs (s1…) — every space the artist owns, so moves stay grounded.
  let s = 0;
  const formatStages = (spaceId: string): string => {
    const list = stagesBySpace.get(spaceId) ?? [];
    if (!list.length) return "(none)";
    return list
      .map((stage) => {
        s += 1;
        const ref = `s${s}`;
        refs[ref] = {
          type: "stage",
          id: stage.id,
          spaceId,
          name: stage.name,
        };
        return `[${ref}] ${clip(stage.name, 40)}`;
      })
      .join(", ");
  };

  if (active) {
    lines.push(
      `Active space: ${clip(active.name)} — stages: ${formatStages(active.id)}`,
    );
  }
  if (others.length) {
    for (const space of others) {
      lines.push(
        `Other space: ${clip(space.name)} — stages: ${formatStages(space.id)}`,
      );
    }
  }

  const openTasks = tasks.length;
  lines.push(
    `Totals: ${tracks.length}${tracks.length >= 80 ? "+" : ""} tracks, ${projects.length}${projects.length >= 40 ? "+" : ""} projects, ${openTasks}${openTasks >= 40 ? "+" : ""} open tasks`,
  );

  // --- Needs attention ---
  type AttRow = {
    track: (typeof tracks)[number];
    signals: ReturnType<typeof deriveAttentionSignals>;
  };
  const attention: AttRow[] = [];
  for (const track of tracks) {
    const signals = deriveAttentionSignals({ track });
    if (signals.length === 0) continue;
    attention.push({ track, signals });
  }
  attention.sort((a, b) => {
    const pa = signalPriority(a.signals[0]!);
    const pb = signalPriority(b.signals[0]!);
    if (pa !== pb) return pa - pb;
    const da = a.track.next_action_due || a.track.deadline || "9999";
    const db = b.track.next_action_due || b.track.deadline || "9999";
    return da.localeCompare(db);
  });

  const topAttention = attention.slice(0, ATTENTION_CAP);
  if (topAttention.length) {
    lines.push("", "## Needs attention (from TEMPO's own signals)");
    let k = 0;
    for (const { track, signals } of topAttention) {
      k += 1;
      const ref = `k${k}`;
      refs[ref] = { type: "track", id: track.id, spaceId: track.space_id };
      const stage = track.stage_id
        ? stageNameById.get(track.stage_id) ?? "?"
        : "?";
      const sig = signals[0]!;
      const bits = [`[${ref}] "${clip(track.title)}" — ${stage}`];

      const stageAge = daysBetween(track.stage_entered_at, now);
      if (sig.id === "stage-stale" && stageAge != null) {
        bits.push(`stalled ${Math.floor(stageAge)} days`);
      } else if (sig.id === "blocked" && track.blocked_reason) {
        bits.push(`blocked: ${clip(track.blocked_reason, 50)}`);
      } else if (sig.id === "waiting" && track.waiting_on) {
        bits.push(`waiting on ${clip(track.waiting_on, 40)}`);
      } else if (sig.id === "deadline-approaching" && track.deadline) {
        const d = daysUntil(track.deadline, now);
        bits.push(
          d != null && d < 0
            ? `deadline ${track.deadline}, overdue`
            : `deadline ${track.deadline}${d != null ? `, ${Math.ceil(d)} days out` : ""}`,
        );
      } else {
        bits.push(sig.explanation.slice(0, 80));
      }

      if (track.next_action?.trim()) {
        bits.push(`next action: "${clip(track.next_action, 50)}"`);
      }
      lines.push(bits.join(" — "));
    }
  }

  // --- Open tasks ---
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  const topTasks = sortedTasks.slice(0, TASK_CAP);
  if (topTasks.length) {
    lines.push("", "## Open tasks due soonest");
    let t = 0;
    for (const task of topTasks) {
      t += 1;
      const ref = `t${t}`;
      refs[ref] = { type: "task", id: task.id };
      const due = task.due_date
        ? (() => {
            const d = daysUntil(task.due_date, now);
            if (d != null && d < 0) return `due ${task.due_date} — OVERDUE`;
            return `due ${task.due_date}`;
          })()
        : "no due date";
      lines.push(
        `[${ref}] "${clip(task.title)}" — ${task.category} — ${due}`,
      );
    }
  }

  // --- Projects ---
  const projectTrackCounts = new Map<string, number>();
  const releaseByProject = new Map<string, string>();
  if (projects.length) {
    const ids = projects.map((p) => p.id);
    const [linkedTracks, releaseRes] = await Promise.all([
      supabase.from("tracks").select("project_id").in("project_id", ids),
      supabase
        .from("release_details")
        .select("project_id, release_date")
        .in("project_id", ids),
    ]);
    for (const link of linkedTracks.data ?? []) {
      if (!link.project_id) continue;
      projectTrackCounts.set(
        link.project_id,
        (projectTrackCounts.get(link.project_id) ?? 0) + 1,
      );
    }
    for (const row of releaseRes.data ?? []) {
      if (row.release_date) releaseByProject.set(row.project_id, row.release_date);
    }
  }

  const topProjects = projects.slice(0, PROJECT_CAP);
  if (topProjects.length) {
    lines.push("", "## Projects");
    let p = 0;
    for (const project of topProjects) {
      p += 1;
      const ref = `p${p}`;
      refs[ref] = { type: "project", id: project.id };
      const count = projectTrackCounts.get(project.id) ?? 0;
      const release =
        releaseByProject.get(project.id) || project.deadline
          ? ` — release ${releaseByProject.get(project.id) || project.deadline}`
          : "";
      lines.push(
        `[${ref}] "${clip(project.name)}" — ${project.project_type}${release} — ${count} tracks`,
      );
    }
  }

  // --- Recently touched (skip ones already listed as k1.. under attention) ---
  const attentionIds = new Set(topAttention.map((a) => a.track.id));
  const recent = tracks
    .filter((tr) => !attentionIds.has(tr.id))
    .slice(0, RECENT_CAP);

  // Continue k numbering after attention refs
  let kNext = topAttention.length;
  if (recent.length) {
    lines.push("", "## Recently touched tracks");
    for (const track of recent) {
      kNext += 1;
      const ref = `k${kNext}`;
      refs[ref] = { type: "track", id: track.id, spaceId: track.space_id };
      const stage = track.stage_id
        ? stageNameById.get(track.stage_id) ?? "?"
        : "?";
      lines.push(
        `[${ref}] "${clip(track.title)}" — ${stage} — ${track.momentum}`,
      );
    }
  }

  // Also register attention tracks that weren't in recent — already done above.

  return { text: lines.join("\n"), refs };
}
