"use client";

import * as React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlareLine } from "@/components/flare-line";
import { summarizeCommitPayload, toCommitPayload } from "@/lib/ai/commit-payload";
import type { WorkspaceImportPlan } from "@/lib/ai/import-plan-schema";
import type { ReviewSelection } from "@/components/import/plan-review";

type CommitSummaryProps = {
  plan: WorkspaceImportPlan;
  selection: ReviewSelection;
  onBack: () => void;
  onBuild: () => void;
  building: boolean;
};

/**
 * The last screen before anything is written. Counts come from the exact same
 * function that builds the commit payload, so what's promised here is what
 * lands.
 */
export function CommitSummary({
  plan,
  selection,
  onBack,
  onBuild,
  building,
}: CommitSummaryProps) {
  const payload = React.useMemo(
    () =>
      toCommitPayload(plan, {
        trackRefs: Array.from(selection.trackRefs),
        projectRefs: Array.from(selection.projectRefs),
        taskRefs: Array.from(selection.taskRefs),
      }),
    [plan, selection],
  );

  const counts = summarizeCommitPayload(payload);
  const reusedSpaces = payload.spaces.filter((s) => s.existingId).length;

  const rows: { label: string; value: number }[] = [
    { label: counts.spaces === 1 ? "new space" : "new spaces", value: counts.spaces },
    { label: counts.tracks === 1 ? "track" : "tracks", value: counts.tracks },
    { label: counts.projects === 1 ? "project" : "projects", value: counts.projects },
    { label: counts.tasks === 1 ? "task" : "tasks", value: counts.tasks },
    {
      label: counts.checklistItems === 1 ? "checklist item" : "checklist items",
      value: counts.checklistItems,
    },
  ].filter((r) => r.value > 0);

  return (
    <div className="mx-auto max-w-lg">
      <div className="panel p-6">
        <div className="text-center">
          <FlareLine variant="tick" className="mx-auto mb-4 !w-16" />
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-hi">
            Here&rsquo;s what TEMPO will build
          </h2>
          <p className="mt-2 text-sm text-text-lo">
            Nothing has been added to your catalog yet.
          </p>
        </div>

        <ul className="mt-6 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="well flex items-baseline gap-3 px-4 py-3">
              <span className="stat-value text-text-hi">{row.value}</span>
              <span className="text-sm text-text-lo">{row.label}</span>
            </li>
          ))}
        </ul>

        {reusedSpaces > 0 ? (
          <p className="mt-4 text-center text-xs text-text-lo">
            Going into {reusedSpaces === 1 ? "your existing space" : `${reusedSpaces} of your existing spaces`}.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" size="lg" onClick={onBuild} disabled={building}>
            {building ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Building…
              </>
            ) : (
              "Build my TEMPO workspace"
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onBack} disabled={building}>
            <ArrowLeft className="size-4" />
            Back to review
          </Button>
        </div>
      </div>
    </div>
  );
}
