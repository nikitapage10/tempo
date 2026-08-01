"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { IntakeCanvas } from "@/components/import/intake-canvas";
import { ProcessingView } from "@/components/import/processing-view";
import { PlanReview, type ReviewSelection } from "@/components/import/plan-review";
import { CommitSummary } from "@/components/import/commit-summary";
import { useActiveSpace } from "@/components/active-space-provider";
import { fetchStages } from "@/lib/api/stages";
import {
  commitImport,
  createImport,
  discardImport,
  extractAll,
  fetchImport,
  synthesize,
  type ImportSource,
} from "@/lib/api/onboarding-imports";
import { DEFAULT_STAGE_NAMES } from "@/lib/constants";
import type { WorkspaceImportPlan } from "@/lib/ai/import-plan-schema";

export type ImportStep = "intake" | "processing" | "review" | "confirm" | "done";

export function ImportExperience({
  onComplete,
  onDiscard,
  embedded = false,
  onStepChange,
}: {
  /** Called once a workspace has actually been built. */
  onComplete: () => void;
  /** Called when the artist backs out without importing. */
  onDiscard: () => void;
  /** Inside ORIGIN: drop the page chrome, the film supplies the frame. */
  embedded?: boolean;
  /** Lets ORIGIN title and place each import stage like a story chapter. */
  onStepChange?: (step: ImportStep) => void;
}) {
  // Navigation is the caller's job: the same flow runs as a page and as a
  // chapter inside ORIGIN, which finish in different places.
  const qc = useQueryClient();
  const { toast } = useToast();
  const { spaces } = useActiveSpace();

  const [importId, setImportId] = React.useState<string | null>(null);
  const [startupError, setStartupError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<ImportStep>("intake");
  const [sources, setSources] = React.useState<ImportSource[]>([]);
  const [plan, setPlan] = React.useState<WorkspaceImportPlan | null>(null);
  const [selection, setSelection] = React.useState<ReviewSelection>({
    trackRefs: new Set(),
    projectRefs: new Set(),
    taskRefs: new Set(),
  });
  const [phase, setPhase] = React.useState<"extracting" | "synthesizing">("extracting");
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [answering, setAnswering] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [stagesBySpaceId, setStagesBySpaceId] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // One import session per visit to this page.
  React.useEffect(() => {
    let cancelled = false;
    createImport()
      .then((res) => {
        if (!cancelled) setImportId(res.id);
      })
      .catch((err) => {
        // A new account is redirected straight here, so this must never sit on
        // a spinner — say what's wrong and give them a way into the app.
        if (!cancelled) {
          setStartupError(
            err instanceof Error ? err.message : "Couldn’t start an import.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage names per space, so the review screen can offer a real stage list.
  React.useEffect(() => {
    let cancelled = false;
    Promise.all(
      spaces.map(async (space) => {
        const stages = await fetchStages(space.id).catch(() => []);
        return [space.id, stages.map((s) => s.name)] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setStagesBySpaceId(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [spaces]);

  const refreshSources = React.useCallback(async () => {
    if (!importId) return;
    try {
      const snapshot = await fetchImport(importId);
      setSources(snapshot.sources);
    } catch {
      /* the intake screen keeps what it has */
    }
  }, [importId]);

  /** Everything a proposed space's tracks can be staged into. */
  function stageOptionsForSpaceRef(spaceRef: string): string[] {
    const space = plan?.spaces.find((s) => s.ref === spaceRef);
    if (space?.existingId && stagesBySpaceId[space.existingId]) {
      return stagesBySpaceId[space.existingId];
    }
    return [...DEFAULT_STAGE_NAMES];
  }

  function selectAll(next: WorkspaceImportPlan) {
    // Everything starts ticked — the artist unticks what they don't want,
    // which is the same idiom as the stage-recipe preview dialog.
    setSelection({
      trackRefs: new Set(next.tracks.map((t) => t.ref)),
      projectRefs: new Set(next.projects.map((p) => p.ref)),
      taskRefs: new Set(next.tasks.map((k) => k.ref)),
    });
  }

  async function handleProcess() {
    if (!importId) return;
    setBusy(true);
    setStep("processing");
    setPhase("extracting");

    try {
      const extractWarnings = await extractAll(importId, () => void refreshSources());
      setWarnings(extractWarnings);
      await refreshSources();

      setPhase("synthesizing");
      const nextPlan = await synthesize(importId);

      if (nextPlan.tracks.length === 0 && nextPlan.projects.length === 0) {
        toast("TEMPO couldn’t find any tracks in that. Try adding more detail.");
        setStep("intake");
        return;
      }

      setPlan(nextPlan);
      selectAll(nextPlan);
      setStep("review");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t read that.");
      setStep("intake");
    } finally {
      setBusy(false);
    }
  }

  async function handleAnswers(answers: { question: string; answer: string }[]) {
    if (!importId) return;
    setAnswering(true);
    try {
      const nextPlan = await synthesize(importId, answers);
      setPlan(nextPlan);
      selectAll(nextPlan);
      toast("Redrafted with your answers.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t redraft that.");
    } finally {
      setAnswering(false);
    }
  }

  async function handleBuild() {
    if (!importId || !plan) return;
    setBusy(true);
    try {
      const summary = await commitImport(importId, plan, {
        trackRefs: Array.from(selection.trackRefs),
        projectRefs: Array.from(selection.projectRefs),
        taskRefs: Array.from(selection.taskRefs),
      });

      // Everything on screen is now stale — the catalog just changed.
      await qc.invalidateQueries();

      const built = [
        summary.tracks ? `${summary.tracks} track${summary.tracks === 1 ? "" : "s"}` : null,
        summary.projects ? `${summary.projects} project${summary.projects === 1 ? "" : "s"}` : null,
        summary.tasks ? `${summary.tasks} task${summary.tasks === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(", ");

      setStep("done");
      toast(`Your studio is ready — ${built}.`, "ok");
      onComplete();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t build your workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    if (importId) {
      try {
        await discardImport(importId);
      } catch {
        /* leaving anyway */
      }
    }
    onDiscard();
  }

  return (
    <div className={embedded ? "w-full" : "mx-auto max-w-5xl"}>
      {/* Inside ORIGIN the story's own chapter heading already introduces this,
          and a page header floating over the film would break the spell. */}
      {embedded ? (
        <div className="mb-4 flex justify-end">
          {step !== "done" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (sources.length > 0) setConfirmDiscard(true);
                else void handleDiscard();
              }}
            >
              Not now
            </Button>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title="Bring your music in"
          subtitle={
            step === "intake"
              ? "Give TEMPO whatever you already have. It'll organise it with you — nothing is added until you say so."
              : step === "processing"
                ? "Reading through what you gave me."
                : step === "review"
                  ? "Here's what TEMPO found. Fix anything that's wrong."
                  : "Last look before anything is created."
          }
          actions={
            step !== "done" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDiscard(true)}
              >
                <Trash2 className="size-4" />
                Discard
              </Button>
            ) : null
          }
        />
      )}

      {startupError ? (
        <div className="panel p-6 text-center">
          <h2 className="font-display text-lg font-semibold text-text-hi">
            Import isn&rsquo;t available yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-lo">
            {startupError}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-text-lo">
            If this is a fresh setup, migration 014 still needs running in Supabase
            and an OpenAI key needs adding to the server. Everything else in TEMPO
            works in the meantime.
          </p>
          {embedded ? (
            <Button className="mt-5" type="button" onClick={onDiscard}>
              Keep going without import
            </Button>
          ) : (
            <Button className="mt-5" asChild>
              <Link href="/">Go to Today</Link>
            </Button>
          )}
        </div>
      ) : !importId ? (
        <div className="panel h-48 animate-pulse" />
      ) : step === "intake" ? (
        <IntakeCanvas
          importId={importId}
          sources={sources}
          onSourcesChanged={() => void refreshSources()}
          onReady={() => void handleProcess()}
          busy={busy}
          embedded={embedded}
        />
      ) : step === "processing" ? (
        <ProcessingView sources={sources} phase={phase} warnings={warnings} />
      ) : step === "review" && plan ? (
        <PlanReview
          plan={plan}
          onPlanChange={setPlan}
          selection={selection}
          onSelectionChange={setSelection}
          stageOptionsForSpaceRef={stageOptionsForSpaceRef}
          onAnswerQuestions={(answers) => void handleAnswers(answers)}
          answering={answering}
          onContinue={() => setStep("confirm")}
        />
      ) : step === "confirm" && plan ? (
        <CommitSummary
          plan={plan}
          selection={selection}
          onBack={() => setStep("review")}
          onBuild={() => void handleBuild()}
          building={busy}
        />
      ) : null}

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent
          title="Discard this import?"
          description="Everything you added here is deleted, including the files you uploaded. Nothing in your catalog changes."
          onClose={() => setConfirmDiscard(false)}
        >
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep going
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDiscard()}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
