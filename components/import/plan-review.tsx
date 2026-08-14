"use client";

import * as React from "react";
import { ChevronDown, CircleAlert, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlareLine } from "@/components/flare-line";
import {
  MOMENTUM_OPTIONS,
  PROJECT_TYPES,
  TASK_CATEGORIES,
  TRACK_TYPES,
} from "@/lib/constants";
import type {
  Confidence,
  ProposedProject,
  ProposedTask,
  ProposedTrack,
  WorkspaceImportPlan,
} from "@/lib/ai/import-plan-schema";
import { cn } from "@/lib/utils";

export type ReviewSelection = {
  trackRefs: Set<string>;
  projectRefs: Set<string>;
  taskRefs: Set<string>;
};

type PlanReviewProps = {
  plan: WorkspaceImportPlan;
  onPlanChange: (plan: WorkspaceImportPlan) => void;
  selection: ReviewSelection;
  onSelectionChange: (selection: ReviewSelection) => void;
  /** Stage names available per proposed space ref, for the stage dropdown. */
  stageOptionsForSpaceRef: (spaceRef: string) => string[];
  onAnswerQuestions: (answers: { question: string; answer: string }[]) => void;
  answering: boolean;
  onContinue: () => void;
  embedded?: boolean;
};

const CONFIDENCE_TONE: Record<Confidence, string> = {
  high: "text-ok",
  medium: "text-amber",
  low: "text-warn",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "confident",
  medium: "fairly sure",
  low: "guessing",
};

/** A field TEMPO inferred, with the reason it gives the artist. */
function Provenance({
  confidence,
  reason,
}: {
  confidence: Confidence;
  reason: string;
}) {
  if (!reason) return null;
  return (
    <p className="font-data mt-1 text-xs text-text-lo">
      <span className={CONFIDENCE_TONE[confidence]}>{CONFIDENCE_LABEL[confidence]}</span>
      {" · "}
      {reason}
    </p>
  );
}

function toggle(set: Set<string>, ref: string): Set<string> {
  const next = new Set(set);
  if (next.has(ref)) next.delete(ref);
  else next.add(ref);
  return next;
}

// ---------- Track ----------

function TrackCard({
  track,
  selected,
  onToggle,
  onChange,
  stageOptions,
}: {
  track: ProposedTrack;
  selected: boolean;
  onToggle: () => void;
  onChange: (next: ProposedTrack) => void;
  stageOptions: string[];
}) {
  const [expanded, setExpanded] = React.useState(false);

  /** Editing a value makes it the artist's, so it stops reading as a guess. */
  function setField<K extends keyof ProposedTrack>(key: K, value: ProposedTrack[K]) {
    onChange({ ...track, [key]: value });
  }

  function setInferred(
    key: "type" | "stageName" | "momentum" | "bpm" | "musicalKey" | "deadline" | "nextAction",
    value: string | number | null,
  ) {
    const field = track[key];
    onChange({
      ...track,
      [key]: {
        ...field,
        value: value === "" ? null : value,
        confidence: "high",
        reasoningSummary: "You set this.",
      },
    });
  }

  return (
    <li
      className={cn(
        "rounded-card border p-3 transition-colors duration-hover",
        selected ? "border-ice/30 bg-ice/5" : "border-line bg-bg-2/40",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Include ${track.title}`}
          className="mt-1.5 size-3.5 shrink-0 accent-[var(--ice)]"
        />

        <div className="min-w-0 flex-1">
          <Input
            value={track.title}
            onChange={(e) => setField("title", e.target.value)}
            className="h-8 font-display text-sm"
            aria-label="Track title"
          />

          {track.possibleDuplicateOf ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber">
              <Copy className="mt-0.5 size-3 shrink-0" />
              You already have a track called &ldquo;{track.possibleDuplicateOf}&rdquo;.
              Untick this if it&rsquo;s the same song.
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select
              value={track.type.value ?? "original"}
              onChange={(e) => setInferred("type", e.target.value)}
              aria-label="Track type"
              className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {TRACK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={track.stageName.value ?? ""}
              onChange={(e) => setInferred("stageName", e.target.value)}
              aria-label="Stage"
              className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <option value="">No stage</option>
              {stageOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={track.momentum.value ?? "active"}
              onChange={(e) => setInferred("momentum", e.target.value)}
              aria-label="Momentum"
              className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {MOMENTUM_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-input px-2 py-1 text-xs text-text-lo transition-colors duration-hover hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <ChevronDown
                className={cn("size-3 transition-transform duration-hover", expanded && "rotate-180")}
              />
              {expanded ? "Less" : "More"}
            </button>
          </div>

          <Provenance
            confidence={track.stageName.confidence}
            reason={track.stageName.reasoningSummary}
          />

          {expanded ? (
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor={`bpm-${track.ref}`}>BPM</Label>
                  <Input
                    id={`bpm-${track.ref}`}
                    value={track.bpm.value ?? ""}
                    inputMode="decimal"
                    className="mt-1 h-8"
                    onChange={(e) =>
                      setInferred("bpm", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`key-${track.ref}`}>Key</Label>
                  <Input
                    id={`key-${track.ref}`}
                    value={track.musicalKey.value ?? ""}
                    className="mt-1 h-8"
                    onChange={(e) => setInferred("musicalKey", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`deadline-${track.ref}`}>Target date</Label>
                  <Input
                    id={`deadline-${track.ref}`}
                    type="date"
                    value={track.deadline.value ?? ""}
                    className="mt-1 h-8"
                    onChange={(e) => setInferred("deadline", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`next-${track.ref}`}>Next move</Label>
                <Input
                  id={`next-${track.ref}`}
                  value={track.nextAction.value ?? ""}
                  className="mt-1 h-8"
                  placeholder="What happens next on this one?"
                  onChange={(e) => setInferred("nextAction", e.target.value)}
                />
                <Provenance
                  confidence={track.nextAction.confidence}
                  reason={track.nextAction.reasoningSummary}
                />
              </div>

              <div>
                <Label htmlFor={`notes-${track.ref}`}>Notes</Label>
                <Textarea
                  id={`notes-${track.ref}`}
                  value={track.notes ?? ""}
                  rows={2}
                  className="mt-1"
                  onChange={(e) => setField("notes", e.target.value || null)}
                />
              </div>

              {track.collaborators.length > 0 ? (
                <div>
                  <p className="label-mono mb-1.5 text-text-lo">Mentioned</p>
                  <div className="flex flex-wrap gap-1.5">
                    {track.collaborators.map((name) => (
                      <Chip key={name}>{name}</Chip>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-text-lo">
                    Saved as a note. Invite people properly from the track later.
                  </p>
                </div>
              ) : null}

              {track.checklist.length > 0 ? (
                <div>
                  <p className="label-mono mb-1.5 text-text-lo">
                    Checklist ({track.checklist.length})
                  </p>
                  <ul className="space-y-1">
                    {track.checklist.map((item, i) => (
                      <li key={i} className="text-xs text-text-lo">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ---------- Main ----------

export function PlanReview({
  plan,
  onPlanChange,
  selection,
  onSelectionChange,
  stageOptionsForSpaceRef,
  onAnswerQuestions,
  answering,
  onContinue,
  embedded = false,
}: PlanReviewProps) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  function updateTrack(next: ProposedTrack) {
    onPlanChange({
      ...plan,
      tracks: plan.tracks.map((t) => (t.ref === next.ref ? next : t)),
    });
  }

  function updateProject(next: ProposedProject) {
    onPlanChange({
      ...plan,
      projects: plan.projects.map((p) => (p.ref === next.ref ? next : p)),
    });
  }

  function updateTask(next: ProposedTask) {
    onPlanChange({
      ...plan,
      tasks: plan.tasks.map((k) => (k.ref === next.ref ? next : k)),
    });
  }

  // A track needs a second look when TEMPO isn't confident, or when it might
  // already be in the catalog.
  const needsEyes = (t: ProposedTrack) =>
    t.confidence !== "high" || Boolean(t.possibleDuplicateOf) || !t.stageName.value;

  const readyTracks = plan.tracks.filter((t) => !needsEyes(t));
  const uncertainTracks = plan.tracks.filter(needsEyes);
  const excludedTracks = plan.tracks.filter((t) => !selection.trackRefs.has(t.ref));

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;

  return (
    <div className={cn("space-y-6", embedded && "pb-2")}>
      {plan.overview ? (
        <div className="panel p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-ice" />
            <p className="text-sm leading-relaxed text-text-hi">{plan.overview}</p>
          </div>
        </div>
      ) : null}

      {/* Only what actually changes the workspace gets asked. */}
      {plan.questions.length > 0 ? (
        <section className="panel p-4">
          <p className="label-mono mb-3 text-text-lo">A few things worth checking</p>
          <ul className="space-y-4">
            {plan.questions.map((q) => (
              <li key={q.id}>
                <p className="text-sm text-text-hi">{q.question}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.options.map((option) => (
                    <Chip
                      key={option}
                      active={answers[q.id] === option}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                    >
                      {option}
                    </Chip>
                  ))}
                </div>
                <Input
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Or say it your own way…"
                  className="mt-2 h-8"
                  aria-label={q.question}
                />
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-4"
            disabled={answering || answeredCount === 0}
            onClick={() =>
              onAnswerQuestions(
                plan.questions
                  .filter((q) => (answers[q.id] ?? "").trim())
                  .map((q) => ({ question: q.question, answer: answers[q.id].trim() })),
              )
            }
          >
            {answering ? "Redrafting…" : `Redraft with ${answeredCount} answer${answeredCount === 1 ? "" : "s"}`}
          </Button>
        </section>
      ) : null}

      {/* ---- Ready to add ---- */}
      {readyTracks.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-text-hi">Ready to add</h2>
            <span className="font-data text-xs text-text-lo">{readyTracks.length} tracks</span>
          </div>
          <FlareLine className="mb-3 opacity-40" />
          <ul className="space-y-2">
            {readyTracks.map((track) => (
              <TrackCard
                key={track.ref}
                track={track}
                selected={selection.trackRefs.has(track.ref)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    trackRefs: toggle(selection.trackRefs, track.ref),
                  })
                }
                onChange={updateTrack}
                stageOptions={stageOptionsForSpaceRef(track.spaceRef)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Needs your eyes ---- */}
      {uncertainTracks.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-text-hi">
              <CircleAlert className="size-4 text-amber" />
              Needs your eyes
            </h2>
            <span className="font-data text-xs text-text-lo">{uncertainTracks.length} tracks</span>
          </div>
          <FlareLine className="mb-3 opacity-40" />
          <p className="mb-3 text-xs text-text-lo">
            TEMPO wasn&rsquo;t sure about these. Fix anything that&rsquo;s wrong, or untick
            what shouldn&rsquo;t be added.
          </p>
          <ul className="space-y-2">
            {uncertainTracks.map((track) => (
              <TrackCard
                key={track.ref}
                track={track}
                selected={selection.trackRefs.has(track.ref)}
                onToggle={() =>
                  onSelectionChange({
                    ...selection,
                    trackRefs: toggle(selection.trackRefs, track.ref),
                  })
                }
                onChange={updateTrack}
                stageOptions={stageOptionsForSpaceRef(track.spaceRef)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Projects ---- */}
      {plan.projects.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-text-hi">Projects</h2>
            <span className="font-data text-xs text-text-lo">{plan.projects.length}</span>
          </div>
          <FlareLine className="mb-3 opacity-40" />
          <ul className="space-y-2">
            {plan.projects.map((project) => {
              const selected = selection.projectRefs.has(project.ref);
              const trackCount = plan.tracks.filter((t) => t.projectRef === project.ref).length;
              return (
                <li
                  key={project.ref}
                  className={cn(
                    "rounded-card border p-3 transition-colors duration-hover",
                    selected ? "border-ice/30 bg-ice/5" : "border-line bg-bg-2/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        onSelectionChange({
                          ...selection,
                          projectRefs: toggle(selection.projectRefs, project.ref),
                        })
                      }
                      aria-label={`Include ${project.name}`}
                      className="mt-1.5 size-3.5 shrink-0 accent-[var(--ice)]"
                    />
                    <div className="min-w-0 flex-1">
                      <Input
                        value={project.name}
                        onChange={(e) => updateProject({ ...project, name: e.target.value })}
                        className="h-8 font-display text-sm"
                        aria-label="Project name"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <select
                          value={project.projectType.value ?? "general"}
                          onChange={(e) =>
                            updateProject({
                              ...project,
                              projectType: {
                                ...project.projectType,
                                value: e.target.value as never,
                                confidence: "high",
                                reasoningSummary: "You set this.",
                              },
                            })
                          }
                          aria-label="Project type"
                          className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                        >
                          {PROJECT_TYPES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <span className="font-data text-xs text-text-lo">
                          {trackCount} track{trackCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <Provenance
                        confidence={project.projectType.confidence}
                        reason={project.projectType.reasoningSummary}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- Tasks ---- */}
      {plan.tasks.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-text-hi">Tasks</h2>
            <span className="font-data text-xs text-text-lo">{plan.tasks.length}</span>
          </div>
          <FlareLine className="mb-3 opacity-40" />
          <ul className="space-y-2">
            {plan.tasks.map((task) => {
              const selected = selection.taskRefs.has(task.ref);
              return (
                <li
                  key={task.ref}
                  className={cn(
                    "flex items-start gap-3 rounded-card border p-3 transition-colors duration-hover",
                    selected ? "border-ice/30 bg-ice/5" : "border-line bg-bg-2/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      onSelectionChange({
                        ...selection,
                        taskRefs: toggle(selection.taskRefs, task.ref),
                      })
                    }
                    aria-label={`Include ${task.title}`}
                    className="mt-1.5 size-3.5 shrink-0 accent-[var(--ice)]"
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      value={task.title}
                      onChange={(e) => updateTask({ ...task, title: e.target.value })}
                      className="h-8 text-sm"
                      aria-label="Task title"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <select
                        value={task.category.value ?? "other"}
                        onChange={(e) =>
                          updateTask({
                            ...task,
                            category: {
                              ...task.category,
                              value: e.target.value as never,
                              confidence: "high",
                              reasoningSummary: "You set this.",
                            },
                          })
                        }
                        aria-label="Task category"
                        className="h-7 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                      >
                        {TASK_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {task.dueDate.value ? (
                        <span className="font-data text-xs text-text-lo">
                          due {task.dueDate.value}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- Not imported ---- */}
      {excludedTracks.length > 0 || plan.warnings.length > 0 ? (
        <section className="panel-quiet p-4">
          <p className="label-mono mb-2 text-text-lo">Not importing</p>
          <ul className="space-y-1">
            {excludedTracks.map((track) => (
              <li key={track.ref} className="text-xs text-text-lo">
                · {track.title} — you unticked this
              </li>
            ))}
            {plan.warnings.map((warning, i) => (
              <li key={`w${i}`} className="text-xs text-text-lo">
                · {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div
        className={cn(
          "flex justify-end",
          embedded &&
            "sticky bottom-0 z-10 -mx-1 border-t border-line/40 bg-[linear-gradient(to_top,rgb(9_10_13)_70%,rgb(9_10_13/0.92),transparent)] px-1 pb-1 pt-3"
        )}
      >
        <Button type="button" size="lg" onClick={onContinue}>
          Review what gets built
        </Button>
      </div>
    </div>
  );
}
