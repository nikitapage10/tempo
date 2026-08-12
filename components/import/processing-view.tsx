"use client";

import * as React from "react";
import { Check, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { FlareLine } from "@/components/flare-line";
import type { ImportSource } from "@/lib/api/onboarding-imports";
import { cn } from "@/lib/utils";

type ProcessingViewProps = {
  sources: ImportSource[];
  phase: "extracting" | "synthesizing";
  warnings: string[];
};

const PHASE_COPY: Record<ImportSource["kind"], string> = {
  text: "Reading your notes",
  voice: "Transcribing the voice note",
  image: "Reading the screenshot",
  document: "Extracting rows",
};

/**
 * Concrete progress, taken from real per-source state. Deliberately never says
 * "AI is thinking" — the artist should be able to see which of their files is
 * being read and which one failed.
 */
export function ProcessingView({ sources, phase, warnings }: ProcessingViewProps) {
  const done = sources.filter((s) => s.status === "ready" || s.status === "excluded").length;
  const failed = sources.filter((s) => s.status === "failed").length;
  const total = sources.length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel p-6">
        <div className="text-center">
          <FlareLine variant="tick" className="mx-auto mb-4 !w-16" />
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-hi">
            {phase === "synthesizing"
              ? "Working out how it fits together"
              : "Reading what you gave me"}
          </h2>
          <p className="mt-2 text-sm text-text-lo">
            {phase === "synthesizing"
              ? "Grouping versions, spotting duplicates, and drafting your workspace."
              : `${done} of ${total} read${failed ? ` · ${failed} couldn’t be read` : ""}`}
          </p>
        </div>

        <ul className="mt-6 space-y-2">
          {sources.map((source) => {
            const isDone = source.status === "ready";
            const isSkipped = source.status === "excluded";
            const isFailed = source.status === "failed";
            const isWorking = source.status === "extracting";

            return (
              <li key={source.id} className="well flex items-center gap-3 px-3 py-2">
                <span className="shrink-0">
                  {isDone ? (
                    <Check className="size-3.5 text-ok" />
                  ) : isFailed ? (
                    <TriangleAlert className="size-3.5 text-warn" />
                  ) : isWorking ? (
                    <Loader2 className="size-3.5 animate-spin text-ice" />
                  ) : (
                    <CircleDashed className="size-3.5 text-text-lo" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    isDone || isWorking ? "text-text-hi" : "text-text-lo",
                  )}
                >
                  {source.label || PHASE_COPY[source.kind]}
                </span>
                <span className="font-data shrink-0 text-xs text-text-lo">
                  {isWorking
                    ? PHASE_COPY[source.kind]
                    : isDone
                      ? "read"
                      : isSkipped
                        ? "nothing usable"
                        : isFailed
                          ? "couldn’t read"
                          : "waiting"}
                </span>
              </li>
            );
          })}
        </ul>

        {phase === "synthesizing" ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-text-lo">
            <Loader2 className="size-3.5 animate-spin text-ice" />
            Comparing titles, grouping versions, preparing questions…
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <ul className="mt-5 space-y-1 border-t border-line pt-4">
            {warnings.map((warning, i) => (
              <li key={i} className="text-xs text-text-lo">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
