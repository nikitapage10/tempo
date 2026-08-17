"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  GripVertical,
  Palette,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useActiveSpace } from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { TaskCategoryManager } from "@/components/tasks/task-category-manager";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { useProjects } from "@/hooks/use-projects";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { localDateString } from "@/lib/format";
import {
  PRO_WORKFLOW_COLUMNS,
  filterWorkflowTasks,
  groupWorkflowTasks,
} from "@/lib/tasks/workflow-board";
import type { Project, Task, TaskCategory, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { taskCategoryChipStyle, taskCategorySurfaceStyle } from "@/lib/tasks/categories";

const selectClass =
  "h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice";

function WorkflowCard({
  task,
  project,
  onStatus,
  overlay = false,
}: {
  task: Task;
  project?: Project;
  onStatus?: (status: TaskStatus) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } =
    useDraggable({
      id: `pro-task:${task.id}`,
      disabled: overlay,
      data: { kind: "pro-task", task, status: task.status },
    });
  const { categories } = useTaskCategoryPalette();
  const category = categories.find((item) => item.key === task.category);
  const categoryLabel = category?.label ?? task.category;
  const overdue =
    task.status !== "done" &&
    Boolean(task.due_date && task.due_date < localDateString());

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "rounded-card border border-line bg-bg-1/95 p-3 shadow-e1 transition-colors",
        isDragging && "opacity-35",
        overlay && "w-[min(340px,82vw)] rotate-1 border-ice/50 shadow-raise"
      )}
      style={!overlay ? taskCategorySurfaceStyle(category) : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-0.5 shrink-0 cursor-grab rounded-input p-1 text-text-lo hover:bg-bg-2 hover:text-ice active:cursor-grabbing"
          aria-label={`Move ${task.title}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks?edit=${task.id}`}
            className={cn(
              "text-sm font-medium text-text-hi hover:text-ice",
              task.status === "done" && "text-text-lo line-through"
            )}
          >
            {task.title}
          </Link>
          {task.notes ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-lo">
              {task.notes}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-text-lo"
          style={taskCategoryChipStyle(category)}
        >
          {categoryLabel}
        </span>
        {project ? (
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 rounded-chip bg-amber/10 px-2 py-0.5 text-[11px] text-amber hover:underline"
          >
            <FolderKanban className="size-3" />
            {project.name}
          </Link>
        ) : null}
        {task.due_date ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-chip bg-bg-2 px-2 py-0.5 font-data text-[11px]",
              overdue ? "text-warn" : "text-text-lo"
            )}
          >
            <CalendarDays className="size-3" />
            {task.due_date}
          </span>
        ) : null}
      </div>

      {!overlay && onStatus ? (
        <select
          aria-label={`Status for ${task.title}`}
          value={task.status}
          onChange={(event) => onStatus(event.target.value as TaskStatus)}
          className="mt-3 h-7 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          {PRO_WORKFLOW_COLUMNS.map((column) => (
            <option key={column.status} value={column.status}>
              {column.label}
            </option>
          ))}
        </select>
      ) : null}
    </article>
  );
}

function WorkflowColumn({
  status,
  label,
  description,
  tasks,
  projectsById,
  onStatus,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  description: string;
  tasks: Task[];
  projectsById: Map<string, Project>;
  onStatus: (task: Task, status: TaskStatus) => void;
  onAdd: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `pro-status:${status}`,
    data: { kind: "pro-status", status },
  });
  const Icon =
    status === "done" ? CheckCircle2 : status === "doing" ? CircleDashed : CircleDashed;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[260px] min-w-0 flex-col rounded-panel border border-line bg-bg-1/55 p-3 transition-colors",
        isOver && "border-ice/60 bg-ice/[0.06]"
      )}
      aria-label={`${label} tasks`}
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-hi">
            <Icon className={cn("size-4", status === "done" ? "text-ok" : status === "doing" ? "text-amber" : "text-ice")} />
            {label}
          </h2>
          <p className="mt-1 text-xs text-text-lo">{description}</p>
        </div>
        <span className="rounded-chip bg-bg-2 px-2 py-0.5 font-data text-xs text-text-lo">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {tasks.map((task) => (
          <WorkflowCard
            key={task.id}
            task={task}
            project={task.project_id ? projectsById.get(task.project_id) : undefined}
            onStatus={(next) => onStatus(task, next)}
          />
        ))}
        {tasks.length === 0 ? (
          <div className="flex min-h-24 flex-1 items-center justify-center rounded-card border border-dashed border-line px-4 text-center text-xs text-text-lo">
            Drop work here, or add the next move.
          </div>
        ) : null}
      </div>

      {status !== "done" ? (
        <button
          type="button"
          onClick={() => onAdd(status)}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-input border border-dashed border-line px-3 py-2 text-xs text-text-lo transition-colors hover:border-ice/40 hover:text-ice"
        >
          <Plus className="size-3.5" />
          Add task
        </button>
      ) : null}
    </section>
  );
}

export function ProWorkflowBoard() {
  const searchParams = useSearchParams();
  const { activeSpace, activeSpaceId, isLoading: spaceLoading } = useActiveSpace();
  const tasksQuery = useTasks(activeSpaceId);
  const projectsQuery = useProjects(activeSpaceId);
  const { create, update } = useTaskMutations(activeSpaceId);
  const { toast } = useToast();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState("");
  const { categories } = useTaskCategoryPalette();
  const [category, setCategory] = React.useState<TaskCategory>("other");
  const [projectId, setProjectId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [newStatus, setNewStatus] = React.useState<TaskStatus>("todo");
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<TaskCategory | "all">("all");
  const [projectFilter, setProjectFilter] = React.useState<string | "all">("all");
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  React.useEffect(() => {
    if (searchParams.get("new") === "1") titleRef.current?.focus();
  }, [searchParams]);

  React.useEffect(() => {
    if (!categories.some((item) => item.key === category)) setCategory("other");
    if (
      categoryFilter !== "all" &&
      !categories.some((item) => item.key === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categories, category, categoryFilter]);

  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const projects = React.useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );
  const projectsById = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const grouped = React.useMemo(
    () =>
      groupWorkflowTasks(
        filterWorkflowTasks(tasks, {
          query,
          category: categoryFilter,
          projectId: projectFilter,
        })
      ),
    [categoryFilter, projectFilter, query, tasks]
  );

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      await create.mutateAsync({
        title: cleanTitle,
        category,
        status: newStatus,
        project_id: projectId || null,
        due_date: dueDate || null,
        space_id: activeSpaceId,
      });
      setTitle("");
      setDueDate("");
      toast(`Added to ${PRO_WORKFLOW_COLUMNS.find((column) => column.status === newStatus)?.label}.`, "ok");
      titleRef.current?.focus();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t add that task.");
    }
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    try {
      await update.mutateAsync({ id: task.id, patch: { status } });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t move that task.");
    }
  }

  function startAdding(status: TaskStatus) {
    setNewStatus(status);
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask((event.active.data.current?.task as Task | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const task = (event.active.data.current?.task as Task | undefined) ?? null;
    const status = event.over?.data.current?.status as TaskStatus | undefined;
    setActiveTask(null);
    if (task && status) void moveTask(task, status);
  }

  if (spaceLoading || tasksQuery.isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-panel border border-line bg-bg-1" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-2">
      <PageHeader
        title="Workflow board"
        subtitle={`Move professional work through the flow in ${activeSpace?.name ?? "this Pro Space"}.`}
        actions={
          <Button type="button" variant="secondary" onClick={() => setCategoryManagerOpen(true)}>
            <Palette /> Categories
          </Button>
        }
      />

      <form onSubmit={addTask} className="panel-quiet mb-4 p-3" aria-label="Quick add task">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px_180px_150px_150px_auto]">
          <Input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add the next move…"
            aria-label="Task title"
          />
          <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as TaskStatus)} className={selectClass} aria-label="Starting status">
            {PRO_WORKFLOW_COLUMNS.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value as TaskCategory)} className={selectClass} aria-label="Task category">
            {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={selectClass} aria-label="Task project">
            <option value="">No project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Task due date" />
          <Button type="submit" disabled={!title.trim() || create.isPending}><Plus /> Add</Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2" role="search" aria-label="Filter workflow board">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-lo" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this flow" className="pl-9" aria-label="Search tasks" />
        </div>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as TaskCategory | "all")} className={selectClass} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className={selectClass} aria-label="Filter by project">
          <option value="all">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragCancel={() => setActiveTask(null)} onDragEnd={handleDragEnd}>
        <div data-pro-board className="grid items-start gap-3 lg:grid-cols-3">
          {PRO_WORKFLOW_COLUMNS.map((column) => (
            <WorkflowColumn
              key={column.status}
              {...column}
              tasks={grouped[column.status]}
              projectsById={projectsById}
              onStatus={(task, status) => void moveTask(task, status)}
              onAdd={startAdding}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <WorkflowCard task={activeTask} project={activeTask.project_id ? projectsById.get(activeTask.project_id) : undefined} overlay /> : null}</DragOverlay>
      </DndContext>
      <TaskCategoryManager open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />
    </div>
  );
}
