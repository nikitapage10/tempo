"use client";

import * as React from "react";
import { Mic, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useOriginSpeech } from "@/hooks/use-origin-speech";
import { parseTaskWithAI } from "@/lib/api/task-parse";
import { parseNaturalTask } from "@/lib/tasks/natural-language";
import { resolveNameToId } from "@/lib/tasks/resolve";
import { RECURRENCE_LABELS } from "@/lib/tasks/recurrence";
import { taskCategoryChipStyle, type TaskCategoryDefinition } from "@/lib/tasks/categories";
import type { TaskParseResult } from "@/lib/tasks/task-schema";
import type { TaskPriority, TaskRecurrence } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  0: "No priority",
  1: "Low",
  2: "High",
  3: "Urgent",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  0: "",
  1: "border-ice/40 bg-ice/10 text-ice",
  2: "border-amber/40 bg-amber/10 text-amber",
  3: "border-warn/40 bg-warn/10 text-warn",
};

const REMINDER_LABELS: Record<number, string> = {
  0: "At due time",
  15: "15 min before",
  30: "30 min before",
  60: "1 hour before",
  1440: "1 day before",
  10080: "1 week before",
};

export type TaskComposerResult = {
  title: string;
  category: string;
  dueDate: string | null;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string | null;
  trackId: string | null;
  steps: string[];
  recurrence: TaskRecurrence | null;
  recurrenceUntil: string | null;
  reminderMinutes: number[];
  notes: string | null;
};

type Draft = {
  title: string;
  category: string;
  dueDate: string | null;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string | null;
  projectName: string | null;
  trackId: string | null;
  trackName: string | null;
  steps: string[];
  recurrence: TaskRecurrence | null;
  reminderMinutes: number[];
  notes: string | null;
};

function draftHasStructure(d: Draft): boolean {
  return Boolean(
    d.dueDate ||
      d.priority !== 0 ||
      d.assigneeId ||
      d.projectId ||
      d.trackId ||
      d.steps.length ||
      d.recurrence ||
      d.reminderMinutes.length ||
      d.notes
  );
}

/**
 * Tasks' primary creation flow — type or dictate a plain sentence and it
 * becomes a structured task. Tries the assistant model first for real
 * language understanding (dates, priority, who it's for, recurrence,
 * reminders); falls back to a local regex parser instantly if the model call
 * fails or isn't configured. A plain title with no detected structure commits
 * immediately; anything richer surfaces an editable interpretation strip so a
 * misheard date or wrong person is never silently written.
 */
export function TaskComposer({
  today,
  timezone,
  categories,
  assignees,
  projects,
  tracks,
  onCreate,
}: {
  today: string;
  timezone: string;
  categories: TaskCategoryDefinition[];
  assignees: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  tracks: Array<{ id: string; name: string }>;
  onCreate: (result: TaskComposerResult) => Promise<void>;
}) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const baseTextRef = React.useRef("");
  const valueRef = React.useRef("");
  valueRef.current = value;

  const speech = useOriginSpeech({
    onTranscript: setValue,
    baseText: () => baseTextRef.current,
  });
  const canSpeak = speech.mode !== "unavailable" && !speech.micDenied;

  async function toggleMic() {
    if (speech.listening) {
      await speech.finish();
      return;
    }
    baseTextRef.current = valueRef.current.trim();
    await speech.start();
  }

  function toDraft(parsed: TaskParseResult): Draft {
    return {
      title: parsed.title,
      category: categories.some((c) => c.key === parsed.category) ? parsed.category : "other",
      dueDate: parsed.dueDate,
      priority: parsed.priority,
      assigneeId: resolveNameToId(parsed.assigneeName, assignees),
      assigneeName: parsed.assigneeName,
      projectId: resolveNameToId(parsed.projectName, projects),
      projectName: parsed.projectName,
      trackId: resolveNameToId(parsed.trackName, tracks),
      trackName: parsed.trackName,
      steps: parsed.steps.filter((s) => s.trim()),
      recurrence: parsed.recurrence,
      reminderMinutes: parsed.reminderMinutes,
      notes: parsed.notes,
    };
  }

  async function commit(d: Draft) {
    await onCreate({
      title: d.title,
      category: d.category,
      dueDate: d.dueDate,
      priority: d.priority,
      assigneeId: d.assigneeId,
      projectId: d.projectId,
      trackId: d.trackId,
      steps: d.steps,
      recurrence: d.recurrence,
      recurrenceUntil: null,
      reminderMinutes: d.reminderMinutes,
      notes: d.notes,
    });
    setValue("");
    setDraft(null);
    setEditing(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      let parsed: TaskParseResult;
      try {
        parsed = await parseTaskWithAI({
          text,
          today,
          timezone,
          categories: categories.map((c) => c.key),
          assignees: assignees.map((a) => a.name),
          projects: projects.map((p) => p.name),
          tracks: tracks.map((t) => t.name),
        });
      } catch {
        parsed = parseNaturalTask(text, today);
      }
      const d = toDraft(parsed);
      if (draftHasStructure(d)) {
        setDraft(d);
      } else {
        await commit(d);
      }
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <div className="glass flex flex-col gap-3 px-4 py-3.5">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Sparkles className="hidden size-4 shrink-0 text-violet sm:block" aria-hidden />
        <label htmlFor="task-composer" className="sr-only">
          Add a task — type or speak
        </label>
        <input
          id="task-composer"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            speech.listening
              ? "Listening…"
              : 'Try "pitch to Sam by Friday, high priority, remind me a day before"'
          }
          disabled={speech.transcribing}
          className="h-10 min-w-0 flex-1 rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi placeholder:text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        />
        {speech.error ? <p className="text-xs text-warn sm:hidden">{speech.error}</p> : null}
        <div className="flex items-center gap-2">
          {canSpeak ? (
            <Button
              type="button"
              size="icon"
              variant={speech.listening ? "secondary" : "ghost"}
              onClick={() => void toggleMic()}
              disabled={speech.transcribing}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? "Stop dictating" : "Dictate a task"}
              className={speech.listening ? "border border-ice/50 bg-ice/10 text-ice" : undefined}
            >
              <Mic className={cn("size-4", speech.listening && "animate-pulse motion-reduce:animate-none")} />
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy || speech.listening || speech.transcribing || !value.trim()}>
            <Sparkles className="size-3.5" />
            {busy ? "Reading…" : speech.transcribing ? "Writing down…" : "Add"}
          </Button>
        </div>
        {speech.error ? <p className="hidden text-xs text-warn sm:block">{speech.error}</p> : null}
      </form>

      {draft ? (
        <div className="well flex flex-col gap-2.5 px-3 py-3">
          <p className="text-sm text-text-hi">{draft.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              size="sm"
              active={editing === "category"}
              style={taskCategoryChipStyle(categories.find((c) => c.key === draft.category), true)}
              onClick={() => setEditing((e) => (e === "category" ? null : "category"))}
            >
              {categories.find((c) => c.key === draft.category)?.label ?? draft.category}
            </Chip>

            <ComposerChip
              active={editing === "due"}
              onClick={() => setEditing((e) => (e === "due" ? null : "due"))}
              onClear={draft.dueDate ? () => updateDraft({ dueDate: null }) : undefined}
            >
              {draft.dueDate
                ? new Date(`${draft.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "No date"}
            </ComposerChip>

            {draft.priority !== 0 ? (
              <ComposerChip
                active={editing === "priority"}
                tone={PRIORITY_TONE[draft.priority]}
                onClick={() => setEditing((e) => (e === "priority" ? null : "priority"))}
                onClear={() => updateDraft({ priority: 0 })}
              >
                {PRIORITY_LABELS[draft.priority]}
              </ComposerChip>
            ) : (
              <ComposerChip active={editing === "priority"} onClick={() => setEditing((e) => (e === "priority" ? null : "priority"))}>
                Priority
              </ComposerChip>
            )}

            <ComposerChip
              active={editing === "assignee"}
              onClick={() => setEditing((e) => (e === "assignee" ? null : "assignee"))}
              onClear={draft.assigneeId || draft.assigneeName ? () => updateDraft({ assigneeId: null, assigneeName: null }) : undefined}
            >
              {draft.assigneeId
                ? `→ ${assignees.find((a) => a.id === draft.assigneeId)?.name ?? draft.assigneeName}`
                : draft.assigneeName
                  ? `→ ${draft.assigneeName}?`
                  : "Assign"}
            </ComposerChip>

            <ComposerChip
              active={editing === "project"}
              onClick={() => setEditing((e) => (e === "project" ? null : "project"))}
              onClear={draft.projectId ? () => updateDraft({ projectId: null, projectName: null }) : undefined}
            >
              {draft.projectId ? (projects.find((p) => p.id === draft.projectId)?.name ?? draft.projectName) : "No project"}
            </ComposerChip>

            {draft.steps.length ? (
              <ComposerChip
                active={editing === "steps"}
                onClick={() => setEditing((e) => (e === "steps" ? null : "steps"))}
                onClear={() => updateDraft({ steps: [] })}
              >
                {draft.steps.length} step{draft.steps.length === 1 ? "" : "s"}
              </ComposerChip>
            ) : null}

            {draft.recurrence ? (
              <ComposerChip
                active={editing === "recurrence"}
                onClick={() => setEditing((e) => (e === "recurrence" ? null : "recurrence"))}
                onClear={() => updateDraft({ recurrence: null })}
              >
                {RECURRENCE_LABELS[draft.recurrence]}
              </ComposerChip>
            ) : null}

            {draft.reminderMinutes.length ? (
              <ComposerChip
                active={editing === "reminder"}
                onClick={() => setEditing((e) => (e === "reminder" ? null : "reminder"))}
                onClear={() => updateDraft({ reminderMinutes: [] })}
              >
                Remind {REMINDER_LABELS[draft.reminderMinutes[0]] ?? ""}
              </ComposerChip>
            ) : null}
          </div>

          {editing === "category" ? (
            <EditorRow>
              {categories.map((c) => (
                <Chip
                  key={c.key}
                  size="sm"
                  active={draft.category === c.key}
                  style={taskCategoryChipStyle(c, draft.category === c.key)}
                  onClick={() => {
                    updateDraft({ category: c.key });
                    setEditing(null);
                  }}
                >
                  {c.label}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          {editing === "due" ? (
            <EditorRow>
              <input
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(e) => updateDraft({ dueDate: e.target.value || null })}
                className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
              />
            </EditorRow>
          ) : null}

          {editing === "priority" ? (
            <EditorRow>
              {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
                <Chip
                  key={p}
                  size="sm"
                  active={draft.priority === p}
                  className={draft.priority === p ? PRIORITY_TONE[p] || undefined : undefined}
                  onClick={() => {
                    updateDraft({ priority: p });
                    setEditing(null);
                  }}
                >
                  {PRIORITY_LABELS[p]}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          {editing === "assignee" ? (
            <EditorRow>
              <Chip size="sm" active={!draft.assigneeId} onClick={() => { updateDraft({ assigneeId: null, assigneeName: null }); setEditing(null); }}>
                Unassigned
              </Chip>
              {assignees.map((a) => (
                <Chip
                  key={a.id}
                  size="sm"
                  active={draft.assigneeId === a.id}
                  onClick={() => {
                    updateDraft({ assigneeId: a.id, assigneeName: a.name });
                    setEditing(null);
                  }}
                >
                  {a.name}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          {editing === "project" ? (
            <EditorRow>
              <Chip size="sm" active={!draft.projectId} onClick={() => { updateDraft({ projectId: null, projectName: null }); setEditing(null); }}>
                None
              </Chip>
              {projects.map((p) => (
                <Chip
                  key={p.id}
                  size="sm"
                  active={draft.projectId === p.id}
                  onClick={() => {
                    updateDraft({ projectId: p.id, projectName: p.name });
                    setEditing(null);
                  }}
                >
                  {p.name}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          {editing === "steps" ? (
            <EditorRow>
              <div className="flex w-full flex-col gap-1">
                {draft.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-text-lo">
                    <span className="flex-1">{step}</span>
                    <button
                      type="button"
                      onClick={() => updateDraft({ steps: draft.steps.filter((_, idx) => idx !== i) })}
                      className="text-text-lo hover:text-warn"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </EditorRow>
          ) : null}

          {editing === "recurrence" ? (
            <EditorRow>
              <Chip size="sm" active={!draft.recurrence} onClick={() => { updateDraft({ recurrence: null }); setEditing(null); }}>
                Doesn&apos;t repeat
              </Chip>
              {(Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]).map((r) => (
                <Chip
                  key={r}
                  size="sm"
                  active={draft.recurrence === r}
                  onClick={() => {
                    updateDraft({ recurrence: r });
                    setEditing(null);
                  }}
                >
                  {RECURRENCE_LABELS[r]}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          {editing === "reminder" ? (
            <EditorRow>
              <Chip size="sm" active={!draft.reminderMinutes.length} onClick={() => { updateDraft({ reminderMinutes: [] }); setEditing(null); }}>
                No reminder
              </Chip>
              {[15, 30, 60, 1440, 10080].map((m) => (
                <Chip
                  key={m}
                  size="sm"
                  active={draft.reminderMinutes.includes(m)}
                  onClick={() => {
                    updateDraft({ reminderMinutes: [m] });
                    setEditing(null);
                  }}
                >
                  {REMINDER_LABELS[m]}
                </Chip>
              ))}
            </EditorRow>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setDraft(null); setEditing(null); }}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void commit(draft)}>
              Add task
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComposerChip({
  active,
  tone,
  onClick,
  onClear,
  children,
}: {
  active?: boolean;
  tone?: string;
  onClick: () => void;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2.5 py-1 text-xs transition-colors duration-hover",
        active ? "border-ice/40 bg-ice/15 text-ice" : tone || "border-line bg-bg-2 text-text-lo hover:text-text-hi"
      )}
    >
      <button type="button" onClick={onClick}>
        {children}
      </button>
      {onClear ? (
        <button type="button" onClick={onClear} aria-label="Clear" className="text-text-lo/70 hover:text-warn">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

function EditorRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 rounded-input border border-line bg-bg-1/60 p-2">{children}</div>;
}
