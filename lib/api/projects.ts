import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectInsert, ProjectUpdate, ProjectWithStats, Task, Track } from "@/lib/types";

export async function fetchProjects(
  spaceId: string | null
): Promise<ProjectWithStats[]> {
  if (!spaceId) return [];
  const supabase = createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!projects?.length) return [];

  const ids = projects.map((p) => p.id);

  const [tracksRes, tasksRes] = await Promise.all([
    supabase.from("tracks").select("id, project_id").in("project_id", ids),
    supabase.from("tasks").select("id, project_id, status").in("project_id", ids),
  ]);

  if (tracksRes.error) throw tracksRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const trackCount = new Map<string, number>();
  const trackIdsByProject = new Map<string, string[]>();
  for (const t of tracksRes.data ?? []) {
    if (!t.project_id) continue;
    trackCount.set(t.project_id, (trackCount.get(t.project_id) ?? 0) + 1);
    const list = trackIdsByProject.get(t.project_id) ?? [];
    list.push(t.id);
    trackIdsByProject.set(t.project_id, list);
  }

  const taskCount = new Map<string, number>();
  const tasksDoneCount = new Map<string, number>();
  for (const t of tasksRes.data ?? []) {
    if (!t.project_id) continue;
    taskCount.set(t.project_id, (taskCount.get(t.project_id) ?? 0) + 1);
    if (t.status === "done") tasksDoneCount.set(t.project_id, (tasksDoneCount.get(t.project_id) ?? 0) + 1);
  }

  const allTrackIds = (tracksRes.data ?? []).map((t) => t.id);
  const checklistPct = new Map<string, number | null>();

  if (allTrackIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("checklist_items")
      .select("done, track_id")
      .in("track_id", allTrackIds);
    if (itemsErr) throw itemsErr;

    const byProject = new Map<string, { done: number; total: number }>();
    const trackToProject = new Map<string, string>();
    trackIdsByProject.forEach((tids, pid) => {
      for (const tid of tids) trackToProject.set(tid, pid);
    });
    for (const item of items ?? []) {
      const pid = trackToProject.get(item.track_id);
      if (!pid) continue;
      const agg = byProject.get(pid) ?? { done: 0, total: 0 };
      agg.total += 1;
      if (item.done) agg.done += 1;
      byProject.set(pid, agg);
    }
    for (const p of projects) {
      const agg = byProject.get(p.id);
      checklistPct.set(
        p.id,
        !agg || agg.total === 0
          ? null
          : Math.round((agg.done / agg.total) * 100)
      );
    }
  } else {
    for (const p of projects) checklistPct.set(p.id, null);
  }

  return projects.map((p) => ({
    ...p,
    track_count: trackCount.get(p.id) ?? 0,
    task_count: taskCount.get(p.id) ?? 0,
    tasks_done_count: tasksDoneCount.get(p.id) ?? 0,
    checklist_pct: checklistPct.get(p.id) ?? null,
  }));
}

export async function fetchProject(id: string): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(input: ProjectInsert): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      deadline: input.deadline || null,
      space_id: input.space_id ?? null,
      status: input.status ?? "active",
      project_type: input.project_type ?? "general",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  patch: ProjectUpdate
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      ...patch,
      deadline: patch.deadline === "" ? null : patch.deadline,
      description:
        patch.description === undefined
          ? undefined
          : patch.description?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProjectTracks(projectId: string): Promise<Track[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    tags: row.tags ?? [],
    bpm: row.bpm != null ? Number(row.bpm) : null,
  }));
}

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function attachTrackToProject(
  trackId: string,
  projectId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tracks")
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", trackId);
  if (error) throw error;
}

export async function attachTaskToProject(
  taskId: string,
  projectId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ project_id: projectId })
    .eq("id", taskId);
  if (error) throw error;
}
