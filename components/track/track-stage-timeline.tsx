"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { prefersReducedMotion } from "@/lib/lightfield";
import type { Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackStageTimelineProps = {
  stages: Stage[];
  currentStageId: string | null;
  onStageChange: (stageId: string) => void;
  isError?: boolean;
  disabled?: boolean;
  /** Stage ids that have an enabled recipe — shows a small indicator dot (FEATURE-SPECS §9). */
  recipeStageIds?: Set<string>;
};

/**
 * Horizontal stage progress control (V2 §6). Prior stages read as muted/done,
 * the current stage carries amber emphasis, future stages stay outlined.
 * Jumping more than one stage asks for confirmation; adjacent/backward moves
 * apply immediately.
 */
export function TrackStageTimeline({
  stages,
  currentStageId,
  onStageChange,
  isError,
  disabled,
  recipeStageIds,
}: TrackStageTimelineProps) {
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [pending, setPending] = React.useState<Stage | null>(null);

  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  React.useEffect(() => {
    if (currentIndex < 0) return;
    const el = btnRefs.current[currentIndex];
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  function attemptChange(stage: Stage, index: number) {
    if (disabled || stage.id === currentStageId) return;
    const distance = currentIndex < 0 ? 0 : Math.abs(index - currentIndex);
    if (distance > 1) {
      setPending(stage);
      return;
    }
    onStageChange(stage.id);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = Math.min(stages.length - 1, index + 1);
    if (e.key === "ArrowLeft") next = Math.max(0, index - 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = stages.length - 1;
    if (next != null && next !== index) {
      e.preventDefault();
      btnRefs.current[next]?.focus();
    }
  }

  if (isError) {
    return (
      <div
        className="rounded-card border border-line bg-bg-1 px-4 py-3"
        role="alert"
      >
        <p className="text-sm text-warn">
          Couldn’t load stages — the rest of the workspace still works.
        </p>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-bg-1/60 px-4 py-3">
        <p className="text-sm text-text-lo">
          No stages set up for this space yet.
        </p>
      </div>
    );
  }

  return (
    <nav
      aria-label="Track stage"
      className="overflow-x-auto rounded-card border border-line bg-bg-1 px-3 py-3 sm:px-4"
    >
      <div
        role="group"
        aria-label="Track stage progress"
        className="flex min-w-max items-center"
      >
        {stages.map((stage, i) => {
          const isCurrent = stage.id === currentStageId;
          const isPrior = currentIndex >= 0 && i < currentIndex;
          const isFuture = currentIndex >= 0 && i > currentIndex;

          return (
            <React.Fragment key={stage.id}>
              {i > 0 ? (
                <div
                  aria-hidden
                  className={cn(
                    "h-px w-6 shrink-0 sm:w-10",
                    isPrior || (isCurrent && currentIndex > 0)
                      ? "bg-ok/50"
                      : "bg-line"
                  )}
                />
              ) : null}
              <button
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={disabled}
                onClick={() => attemptChange(stage, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap rounded-chip border px-3 py-1.5 text-xs font-medium transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:cursor-not-allowed disabled:opacity-60",
                  isCurrent &&
                    "border-amber/50 bg-amber/12 text-amber",
                  isPrior &&
                    "border-ok/30 bg-transparent text-ok/80 hover:border-ok/50",
                  isFuture &&
                    "border-line text-text-lo hover:border-ice/40 hover:text-text-hi",
                  currentIndex < 0 && !isCurrent && "border-line text-text-lo"
                )}
              >
                {stage.name}
                {recipeStageIds?.has(stage.id) ? (
                  <Zap
                    className={cn(
                      "ml-1 inline size-2.5 -translate-y-px",
                      isCurrent ? "text-amber" : "text-ice/70"
                    )}
                    aria-label="Recipe enabled"
                  >
                    <title>Recipe enabled for this stage</title>
                  </Zap>
                ) : null}
                {isCurrent ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-[7px] h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--amber), transparent)",
                    }}
                  />
                ) : null}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <Dialog open={pending != null} onOpenChange={(o) => !o && setPending(null)}>
        {pending ? (
          <DialogContent
            title={`Jump from ${
              currentIndex >= 0 ? stages[currentIndex].name : "here"
            } to ${pending.name}?`}
            description="This skips the stage(s) in between."
            onClose={() => setPending(null)}
          >
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPending(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onStageChange(pending.id);
                  setPending(null);
                }}
              >
                Jump to {pending.name}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </nav>
  );
}
