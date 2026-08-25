"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useActivationJourney } from "@/hooks/use-activation-journey";
import {
  snoozeActivationGuide,
  hideActivationGuide,
  acknowledgeActivationLoopComplete,
} from "@/lib/api/activation-guide-preferences";
import { recordProductEvent } from "@/lib/product-events/client";
import type { RecommendedStep } from "@/lib/activation/derive-journey";
import { useQueryClient } from "@tanstack/react-query";

const STEP_COPY: Record<RecommendedStep, { primaryAction: string; href: (trackId: string | null) => string }> = {
  bring_in_song: { primaryAction: "Bring your music in", href: () => "/import" },
  name_next_move: { primaryAction: "Set the next move", href: (id) => `/track/${id}` },
  work_a_session: { primaryAction: "Start a focus session", href: (id) => `/track/${id}` },
  upload_bounce: { primaryAction: "Upload a bounce", href: (id) => `/track/${id}` },
  get_ears_on_it: { primaryAction: "Share for feedback", href: (id) => `/track/${id}` },
  waiting_for_feedback: { primaryAction: "Copy the guest link", href: (id) => `/track/${id}` },
  close_the_loop: { primaryAction: "Open the feedback", href: (id) => `/track/${id}` },
  loop_complete: { primaryAction: "", href: () => "/" },
};

const PROGRESS_LABELS: Record<string, string> = {
  track_exists: "Brought in a song",
  next_move_set: "Named the next move",
  focus_session_completed: "Worked a focused session",
  bounce_uploaded: "Uploaded a bounce",
  feedback_loop_completed: "Closed a feedback loop",
};

export function ActivationGuideModule({
  spaceId,
  artistId,
  ownerId,
  isExistingMember,
}: {
  spaceId: string;
  artistId: string;
  ownerId: string;
  isExistingMember: boolean;
}) {
  const queryClient = useQueryClient();
  const { journey, isHidden, isSnoozed, isLoading, refetch } = useActivationJourney(
    spaceId,
    artistId,
    ownerId
  );
  const [expanded, setExpanded] = React.useState(!isExistingMember);
  const viewedRef = React.useRef(false);

  React.useEffect(() => {
    if (journey && !viewedRef.current && (expanded || !isExistingMember)) {
      viewedRef.current = true;
      recordProductEvent("activation_guide_viewed", {
        recommended_step: journey.recommendedStep,
        state: journey.state,
      });
    }
  }, [journey, expanded, isExistingMember]);

  if (isLoading || !journey) return null;
  if (isHidden || isSnoozed) return null;
  if (journey.recommendedStep === "loop_complete" && !expanded && isExistingMember) return null;

  const title = journey.targetTrackTitle
    ? `Next up for ${journey.targetTrackTitle}`
    : journey.completedSteps.length === 0
      ? "Your TEMPO loop"
      : "Your TEMPO loop is complete";
  const progressText =
    journey.completedSteps.length === 0
      ? "Nothing yet — let's start."
      : journey.completedSteps.map((s) => PROGRESS_LABELS[s]).join(" · ");

  if (isExistingMember && !expanded) {
    return (
      <section className="panel-quiet flex min-h-[72px] items-center gap-3 px-4 py-3">
        <span
          className="size-1.5 shrink-0 rounded-full bg-amber shadow-[0_0_10px_rgb(255_181_107_/_0.55)]"
          aria-hidden
        />
        <button
          type="button"
          className="text-left text-sm text-text-lo transition-colors hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          onClick={() => setExpanded(true)}
        >
          Want a quick path through TEMPO&apos;s core loop?
        </button>
      </section>
    );
  }

  const stepInfo = STEP_COPY[journey.recommendedStep];

  return (
    <section
      className="panel-quiet px-4 py-4 sm:px-5"
      aria-labelledby="activation-guide-heading"
      role="region"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="label-mono mb-1">Getting started guide</p>
          <h2
            id="activation-guide-heading"
            className="font-display text-base font-semibold tracking-tight text-text-hi"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-text-lo" aria-live="polite">
            {journey.reason}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {journey.recommendedStep !== "loop_complete" ? (
            <>
              <Button
                asChild
                size="sm"
                onClick={() =>
                  recordProductEvent("activation_guide_actioned", {
                    recommended_step: journey.recommendedStep,
                  })
                }
              >
                <Link href={stepInfo.href(journey.targetTrackId)}>{stepInfo.primaryAction}</Link>
              </Button>
              <button
                type="button"
                className="text-xs text-text-lo hover:text-text-hi"
                onClick={async () => {
                  await snoozeActivationGuide(artistId);
                  recordProductEvent("activation_guide_snoozed", {
                    recommended_step: journey.recommendedStep,
                    days: 7,
                  });
                  refetch();
                }}
              >
                Not now
              </button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await acknowledgeActivationLoopComplete(artistId);
                recordProductEvent("activation_loop_completed", {
                  activation_definition_version: journey.definitionVersion,
                });
                queryClient.invalidateQueries({ queryKey: ["activation-guide-preference", artistId] });
              }}
            >
              Nice — got it
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
        <p className="text-xs text-text-lo">
          <span className="font-medium text-text-mid">Completed so far:</span>{" "}
          {progressText}
        </p>
        <button
          type="button"
          className="shrink-0 text-xs text-text-lo hover:text-text-hi hover:underline"
          onClick={async () => {
            await hideActivationGuide(artistId);
            recordProductEvent("activation_guide_hidden", {
              recommended_step: journey.recommendedStep,
            });
            refetch();
          }}
        >
          Hide this guide
        </button>
      </div>
    </section>
  );
}
