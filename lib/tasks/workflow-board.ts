import type { Task, TaskCategory, TaskStatus } from "@/lib/types";

export const PRO_WORKFLOW_COLUMNS: ReadonlyArray<{
  status: TaskStatus;
  label: string;
  description: string;
}> = [
  { status: "todo", label: "To do", description: "Ready to pick up" },
  { status: "doing", label: "In progress", description: "Actively moving" },
  { status: "done", label: "Done", description: "Closed out" },
];

export type WorkflowFilters = {
  query: string;
  category: TaskCategory | "all";
  projectId: string | "all";
};

export function filterWorkflowTasks(
  tasks: Task[],
  filters: WorkflowFilters
): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (filters.category !== "all" && task.category !== filters.category) {
      return false;
    }
    if (filters.projectId !== "all" && task.project_id !== filters.projectId) {
      return false;
    }
    if (!query) return true;
    return `${task.title} ${task.notes ?? ""}`.toLocaleLowerCase().includes(query);
  });
}

export function groupWorkflowTasks(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
  for (const task of tasks) groups[task.status].push(task);
  return groups;
}
