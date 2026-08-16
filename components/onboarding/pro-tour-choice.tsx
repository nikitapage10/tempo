"use client";

import * as React from "react";
import { ArrowRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";

/**
 * Passage does not run the artist's post-Origin workspace tour. Give Pros the
 * same control over interruption without showing them artist-specific steps:
 * opt into the short Pro page guides, or turn every tour off in one choice.
 */
export function ProTourChoice() {
  const onboarding = useMemberOnboarding();
  const { mode, isLoading } = useWorkspaceMode();
  const [visible, setVisible] = React.useState(false);

  const shouldOffer = Boolean(
    !isLoading &&
      mode === "work" &&
      onboarding.data?.eligible &&
      onboarding.data.memberRole === "team_member" &&
      !onboarding.data.proTourChoice
  );

  React.useEffect(() => {
    if (!shouldOffer) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, [shouldOffer]);

  if (!visible) return null;

  function choose(skipAllPageTours: boolean) {
    onboarding.update.mutate(
      {
        proTourChoice: skipAllPageTours ? "skip_all" : "guides",
        skipAllPageTours,
      },
      { onSuccess: () => setVisible(false) }
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-bg-0/85 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-tour-choice-title"
        aria-describedby="pro-tour-choice-copy"
        className="panel relative w-full max-w-[520px] overflow-hidden p-6 shadow-raise sm:p-8"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--ice),white,var(--amber),transparent)]" />
        <span className="flex size-10 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice">
          <Compass className="size-4" />
        </span>
        <p className="label-mono mt-6 text-ice">Your Pro workspace</p>
        <h2
          id="pro-tour-choice-title"
          className="mt-2 max-w-[15ch] font-display text-3xl font-semibold leading-tight tracking-tight text-text-hi sm:text-4xl"
        >
          Would a quick guide help?
        </h2>
        <p id="pro-tour-choice-copy" className="mt-4 max-w-[50ch] text-sm leading-6 text-text-lo">
          TEMPO can show one short guide the first time you open each part of
          your professional home. These are written for Pros—not the artist
          catalog tour—and you can skip any one of them later.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            onClick={() => choose(false)}
            disabled={onboarding.update.isPending}
          >
            Show me the Pro guides <ArrowRight />
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => choose(true)}
            disabled={onboarding.update.isPending}
          >
            Skip all tours <X />
          </Button>
        </div>
      </div>
    </div>
  );
}
