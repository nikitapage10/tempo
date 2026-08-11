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
      <section className="panel-quiet p-4">
        <button
          type="button"
          className="text-left text-sm text-text-lo transition-colors hover:text-text-hi"
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
      className="panel p-5"
      aria-labelledby="activation-guide-heading"
      role="region"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
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

      {journey.recommendedStep !== "loop_complete" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            asChild
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
            className="text-sm text-text-lo hover:text-text-hi"
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
        </div>
      ) : (
        <div className="mt-4">
          <Button
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
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs text-text-lo">
        <span className="font-medium text-text-mid">Completed so far:</span>{" "}
        {progressText}
      </p>
    </section>
  );
}
