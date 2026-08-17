import type { TaskBucket } from "@/lib/tasks/buckets";

export type TaskLaneOrderMap = Partial<Record<TaskBucket, string[]>>;

const KEY_PREFIX = "tempo.taskLaneOrder";

export function laneOrderStorageKey(spaceId: string) {
  return `${KEY_PREFIX}:${spaceId}`;
}

export function readTaskLaneOrder(spaceId: string | null): TaskLaneOrderMap {
  if (!spaceId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(laneOrderStorageKey(spaceId));
    if (!raw) return {};
    return JSON.parse(raw) as TaskLaneOrderMap;
  } catch {
    return {};
  }
}

export function writeTaskLaneOrder(spaceId: string, map: TaskLaneOrderMap) {
  window.localStorage.setItem(laneOrderStorageKey(spaceId), JSON.stringify(map));
}

export function applyTaskLaneOrder<T extends { id: string }>(
  tasks: T[],
  bucket: TaskBucket,
  map: TaskLaneOrderMap
): T[] {
  const ids = map[bucket];
  if (!ids?.length) return tasks;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((task): task is T => Boolean(task));
  const rest = tasks.filter((task) => !ids.includes(task.id));
  return [...ordered, ...rest];
}
