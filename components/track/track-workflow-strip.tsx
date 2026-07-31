"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Info,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { StartFocusDialog } from "@/components/track/start-focus-dialog";
import { useActiveSession, useSessions } from "@/hooks/use-sessions";
import { useRecipeRuns, useRetryRecipeRun } from "@/hooks/use-recipes";
import { useTemplates } from "@/hooks/use-templates";
import { deriveAttentionSignals, signalPriority } from "@/lib/attention/signals";
import { describeRecipeAction } from "@/lib/recipe-actions";
import { formatShortDate } from "@/lib/format";
import type {
  AttentionSeverity,
  AttentionSignal,
  StageRecipeAction,
  StageRecipeRun,
  StageRecipeRunStatus,
  Track,
  TrackUpdate,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { SlitDivider } from "@/components/ui/slit";

type TrackWorkflowStripProps = {
  track: Track;
  onPatch: (patch: TrackUpdate) => Promise<void>;
  /** Unresolved comment threads on this track — feeds the "unresolved feedback" signal. */
  unresolvedCommentCount?: number;
  autoEdit?: "deadline" | "next-action" | null;
};

/**
 * NOW / NEXT / BLOCKED / TARGET at-a-glance strip (V2 §7, FEATURE-SPECS §2).
 * NOW = whose move it is (waiting-on), NEXT = next action + due date,
 * BLOCKED = blocker text, TARGET = the track deadline. Signals surface
 * explainable attention (FEATURE-SPECS §3) with an expand-all toggle.
 */
export function TrackWorkflowStrip({
  track,
  onPatch,
  unresolvedCommentCount,
  autoEdit,
}: TrackWorkflowStripProps) {
  const { data: sessions = [] } = useSessions(track.id);
  const { data: activeSession } = useActiveSession();
  const { data: runs = [] } = useRecipeRuns(track.id);
  const [expanded, setExpanded] = React.useState(false);
  const [focusOpen, setFocusOpen] = React.useState(false);

  React.useEffect(() => {
    if (!autoEdit) return;
    document.getElementById("track-workflow")?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [autoEdit]);

  const sessionHere = activeSession?.track_id === track.id ? activeSession : null;

  const lastSessionAt = React.useMemo(() => {
    if (!sessions.length) return null;
    return sessions.reduce(
      (latest, s) => (s.logged_at > latest ? s.logged_at : latest),
      sessions[0].logged_at
    );
  }, [sessions]);

  const signals = React.useMemo(
    () =>
      deriveAttentionSignals({
        track,
        lastSessionAt,
        unresolvedCommentCount,
      }).sort((a, b) => signalPriority(a) - signalPriority(b)),
    [track, lastSessionAt, unresolvedCommentCount]
  );

  const visibleSignals = expanded ? signals : signals.slice(0, 2);
  const hiddenCount = signals.length - visibleSignals.length;

  return (
    <section
      id="track-workflow"
      className={cn("panel p-5", autoEdit && "ring-2 ring-ice/60")}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Workflow
        </h2>
        {sessionHere ? (
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href={`/track/${track.id}/focus`}>
              <Timer className="size-3.5" />
              Continue focus session
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setFocusOpen(true)}
          >
            <Timer className="size-3.5" />
            Start focus session
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StripCell label="Now">
          <InlineTextField
            value={track.waiting_on ?? ""}
            placeholder="Your move"
            emptyDisplay="Your move"
            onCommit={(next) => onPatch({ waiting_on: next || null })}
            ariaLabel="Waiting on"
            prefix={track.waiting_on ? "Waiting on" : undefined}
          />
        </StripCell>

        <StripCell label="Next">
          <InlineTextField
            value={track.next_action ?? ""}
            placeholder="What’s the next move?"
            emptyDisplay="What’s the next move?"
            onCommit={(next) => onPatch({ next_action: next || null })}
            ariaLabel="Next action"
          />
          <InlineDateField
            value={track.next_action_due}
            onCommit={(next) => onPatch({ next_action_due: next })}
            ariaLabel="Next action due"
            autoEdit={autoEdit === "next-action"}
          />
        </StripCell>

        <StripCell label="Blocked">
          <InlineTextField
            value={track.blocked_reason ?? ""}
            placeholder="Nothing blocking"
            emptyDisplay="Nothing blocking"
            onCommit={(next) => onPatch({ blocked_reason: next || null })}
            ariaLabel="Blocked reason"
            tone={track.blocked_reason?.trim() ? "warn" : undefined}
          />
        </StripCell>

        <StripCell label="Target">
          <InlineDateField
            value={track.deadline}
            onCommit={(next) => onPatch({ deadline: next })}
            ariaLabel="Deadline"
            placeholder="No deadline"
            autoEdit={autoEdit === "deadline"}
          />
        </StripCell>
      </div>

      {signals.length > 0 ? (
        <>
          <SlitDivider className="mt-3" />
          <div className="space-y-1.5 pt-3">
          {visibleSignals.map((s) => (
            <SignalRow key={s.id} signal={s} />
          ))}
          {signals.length > 2 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-ice hover:underline"
            >
              <ChevronDown
                className={cn(
                  "size-3 transition-transform duration-hover",
                  expanded && "rotate-180"
                )}
              />
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </button>
          ) : null}
          </div>
        </>
      ) : null}

      {runs.length > 0 ? <RecentRuns trackId={track.id} runs={runs} /> : null}

      <StartFocusDialog
        open={focusOpen}
        onOpenChange={setFocusOpen}
        trackId={track.id}
        trackTitle={track.title}
      />
    </section>
  );
}

const RUN_STATUS_ICON: Record<
  StageRecipeRunStatus,
  React.ComponentType<{ className?: string }>
> = {
  pending: Info,
  applied: CheckCircle2,
  skipped: CircleSlash,
  partial: AlertCircle,
  failed: XCircle,
};

const RUN_STATUS_CLASS: Record<StageRecipeRunStatus, string> = {
  pending: "text-text-lo",
  applied: "text-ok",
  skipped: "text-text-lo",
  partial: "text-amber",
  failed: "text-warn",
};

/** Small "recent automations" section — what stage recipes ran, and a retry for anything that failed (FEATURE-SPECS §9). */
function RecentRuns({ trackId, runs }: { trackId: string; runs: StageRecipeRun[] }) {
  const { toast } = useToast();
  const templatesQuery = useTemplates();
  const templates = templatesQuery.data ?? [];
  const retry = useRetryRecipeRun(trackId);
  const [expanded, setExpanded] = React.useState(false);

  const visible = expanded ? runs.slice(0, 10) : runs.slice(0, 2);

  function isRecipeActionResultArray(
    value: unknown
  ): value is { action: StageRecipeAction; status: "applied" | "skipped" | "failed" }[] {
    return Array.isArray(value);
  }

  return (
    <>
    <SlitDivider className="mt-3" />
    <div className="pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-lo">
          Recent automations
        </p>
        {runs.length > 2 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-ice hover:underline"
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-hover",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Show less" : `Show ${Math.min(runs.length, 10) - 2} more`}
          </button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {visible.map((run) => {
          const Icon = RUN_STATUS_ICON[run.status];
          const actions = isRecipeActionResultArray(run.action_results)
            ? run.action_results
            : [];
          const canRetry = run.status === "failed" || run.status === "partial";
          return (
            <li key={run.id} className="flex items-start gap-1.5 text-xs">
              <Icon className={cn("mt-0.5 size-3.5 shrink-0", RUN_STATUS_CLASS[run.status])} />
              <div className="min-w-0 flex-1">
                <p className="text-text-lo">
                  {actions
                    .map((r) => describeRecipeAction(r.action, templates))
                    .join(" · ") || "No actions configured"}
                </p>
                <p className="font-mono text-[10px] text-text-lo/70">
                  {formatShortDate(run.created_at)}
                </p>
              </div>
              {canRetry ? (
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 rounded-input px-1.5 py-0.5 text-[11px] text-ice hover:bg-ice/10"
                  disabled={retry.isPending}
                  onClick={async () => {
                    try {
                      await retry.mutateAsync(run);
                      toast("Retried the failed actions", "ok");
                    } catch (err) {
                      toast(
                        err instanceof Error ? err.message : "Retry failed."
                      );
                    }
                  }}
                >
                  <RefreshCw className="size-3" />
                  Retry
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
    </>
  );
}

function StripCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-input border border-line bg-bg-2/50 p-2.5">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-lo">
        {label}
      </p>
      {children}
    </div>
  );
}

function InlineTextField({
  value,
  placeholder,
  emptyDisplay,
  onCommit,
  ariaLabel,
  tone,
  prefix,
  autoEdit = false,
}: {
  value: string;
  placeholder: string;
  emptyDisplay: string;
  onCommit: (next: string) => Promise<void> | void;
  ariaLabel: string;
  tone?: "warn";
  prefix?: string;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setText(value);
  }, [value]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  React.useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);

  function commit() {
    setEditing(false);
    const next = text.trim();
    if (next === value.trim()) {
      setText(value);
      return;
    }
    void onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setText(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-input border border-line bg-bg-1 px-1.5 py-1 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full truncate rounded-input px-1.5 py-1 text-left text-xs transition-colors duration-hover hover:bg-bg-1",
        value.trim()
          ? tone === "warn"
            ? "text-warn"
            : "text-text-hi"
          : "text-text-lo"
      )}
      aria-label={ariaLabel}
    >
      {value.trim() ? (
        <>
          {prefix ? <span className="text-text-lo">{prefix} </span> : null}
          {value}
        </>
      ) : (
        emptyDisplay
      )}
    </button>
  );
}

function InlineDateField({
  value,
  onCommit,
  ariaLabel,
  placeholder = "No date",
  autoEdit = false,
}: {
  value: string | null;
  onCommit: (next: string | null) => Promise<void> | void;
  ariaLabel: string;
  placeholder?: string;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  React.useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value ?? ""}
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value || null;
          if (next !== value) void onCommit(next);
        }}
        aria-label={ariaLabel}
        className="mt-1 w-full rounded-input border border-line bg-bg-1 px-1.5 py-1 font-mono text-[11px] text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "mt-1 block w-full truncate rounded-input px-1.5 py-0.5 text-left font-mono text-[11px] transition-colors duration-hover hover:bg-bg-1",
        value ? "text-amber" : "text-text-lo"
      )}
      aria-label={ariaLabel}
    >
      {value
        ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : placeholder}
    </button>
  );
}

const SEVERITY_ICON: Record<AttentionSeverity, React.ComponentType<{ className?: string }>> = {
  critical: AlertTriangle,
  warn: AlertCircle,
  info: Info,
};

const SEVERITY_CLASS: Record<AttentionSeverity, string> = {
  critical: "text-warn",
  warn: "text-amber",
  info: "text-text-lo",
};

function SignalRow({ signal }: { signal: AttentionSignal }) {
  const Icon = SEVERITY_ICON[signal.severity];
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", SEVERITY_CLASS[signal.severity])} />
      <p className="text-text-lo">
        <span className={cn("font-medium", SEVERITY_CLASS[signal.severity])}>
          {signal.label}
        </span>
        {" — "}
        {signal.explanation}
      </p>
    </div>
  );
}
