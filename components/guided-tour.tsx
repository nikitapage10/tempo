"use client";

import * as React from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";
import {
  completeGuidedTour,
  guidedTourIsPending,
  ORIGIN_ARRIVAL_COMPLETE_EVENT,
  ORIGIN_ARRIVAL_RUNNING_CLASS,
} from "@/lib/guided-tour";
import { cn } from "@/lib/utils";

type TourStep = {
  selector: string;
  kicker: string;
  title: string;
  copy: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="today"]',
    kicker: "Your daily mix",
    title: "Start with Today",
    copy: "This is the room tone of your workspace: what is active, what needs attention, and what is due soon.",
  },
  {
    selector: '[data-tour="today-actions"]',
    kicker: "Shape the work",
    title: "Move while the idea is warm",
    copy: "Add a track or task, log what changed, or drop into a focused session without leaving Today.",
  },
  {
    selector: '[data-tour="workspace-nav"]',
    kicker: "Follow the signal",
    title: "Every part has its place",
    copy: "Board moves work through stages. Calendar holds the timing. Tracks, projects, and tasks keep the detail close.",
  },
  {
    selector: '[data-tour="global-search"]',
    kicker: "Find anything",
    title: "Your whole catalog is in reach",
    copy: "Search tracks, people, notes, tasks, and pages from anywhere. Press Ctrl+K or ⌘K when you want it fast.",
  },
  {
    selector: '[data-tour="assistant"]',
    kicker: "A second set of ears",
    title: "Ask TEMPO",
    copy: "Open the assistant when you need help finding something, understanding the workspace, or making a change.",
  },
];

type TourPhase = "hidden" | "welcome" | "tour" | "skip";
type Point = { top: number; left: number };

function visibleTarget(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    matches.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    }) ?? null
  );
}

function paddedRect(element: HTMLElement): DOMRect {
  const source = element.getBoundingClientRect();
  const pad = source.width < 80 || source.height < 60 ? 10 : 8;
  const left = Math.max(8, source.left - pad);
  const top = Math.max(8, source.top - pad);
  const right = Math.min(window.innerWidth - 8, source.right + pad);
  const bottom = Math.min(window.innerHeight - 8, source.bottom + pad);
  return new DOMRect(left, top, right - left, bottom - top);
}

export function GuidedTour() {
  const onboarding = useMemberOnboarding();
  const [phase, setPhase] = React.useState<TourPhase>("hidden");
  const [stepIndex, setStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [panelPoint, setPanelPoint] = React.useState<Point>({ top: 24, left: 24 });
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const phaseBeforeSkipRef = React.useRef<Exclude<TourPhase, "hidden" | "skip">>("welcome");

  const finish = React.useCallback((skipAllPageTours = false) => {
    completeGuidedTour();
    onboarding.update.mutate({ mainTourCompleted: true, skipAllPageTours });
    setPhase("hidden");
    setTargetRect(null);
    previousFocusRef.current?.focus();
  }, [onboarding.update]);

  const requestSkip = React.useCallback(() => {
    setPhase((current) => {
      if (current === "welcome" || current === "tour") {
        phaseBeforeSkipRef.current = current;
      }
      return "skip";
    });
    setTargetRect(null);
  }, []);

  React.useEffect(() => {
    if (!guidedTourIsPending()) return;

    const open = () => {
      window.setTimeout(() => {
        if (!guidedTourIsPending()) return;
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        setPhase("welcome");
      }, 360);
    };

    // The pre-paint cover clears almost immediately once the dashboard mounts.
    // Wait on the marker that spans the full cinematic wipe instead.
    if (document.documentElement.classList.contains(ORIGIN_ARRIVAL_RUNNING_CLASS)) {
      window.addEventListener(ORIGIN_ARRIVAL_COMPLETE_EVENT, open, { once: true });
      return () => window.removeEventListener(ORIGIN_ARRIVAL_COMPLETE_EVENT, open);
    }

    const timer = window.setTimeout(open, 500);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (phase === "hidden") return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (phase === "skip") setPhase(phaseBeforeSkipRef.current);
        else requestSkip();
      }
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [phase, requestSkip]);

  const measure = React.useCallback(() => {
    if (phase !== "tour") return;
    const target = visibleTarget(TOUR_STEPS[stepIndex].selector);
    setTargetRect(target ? paddedRect(target) : null);
  }, [phase, stepIndex]);

  React.useLayoutEffect(() => {
    if (phase !== "tour") return;
    const target = visibleTarget(TOUR_STEPS[stepIndex].selector);
    target?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    measure();
    const settleTimer = window.setTimeout(measure, 360);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, phase, stepIndex]);

  React.useLayoutEffect(() => {
    if (phase !== "tour") return;
    const panel = panelRef.current;
    if (!panel) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const margin = 16;
    const gap = 18;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);

    if (!targetRect) {
      setPanelPoint({
        left: Math.max(margin, (window.innerWidth - width) / 2),
        top: Math.max(margin, (window.innerHeight - height) / 2),
      });
      return;
    }

    const roomRight = window.innerWidth - targetRect.right;
    const roomBelow = window.innerHeight - targetRect.bottom;
    const roomAbove = targetRect.top;
    let left = Math.min(maxLeft, Math.max(margin, targetRect.left));
    let top = Math.min(maxTop, Math.max(margin, targetRect.bottom + gap));

    if (roomRight >= width + gap) {
      left = targetRect.right + gap;
      top = Math.min(maxTop, Math.max(margin, targetRect.top));
    } else if (roomBelow >= height + gap) {
      top = targetRect.bottom + gap;
    } else if (roomAbove >= height + gap) {
      top = targetRect.top - height - gap;
    } else {
      top = maxTop;
    }

    setPanelPoint({ left, top });
  }, [phase, stepIndex, targetRect]);

  if (phase === "hidden") return null;

  if (phase === "skip") {
    return (
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
        <div aria-hidden className="absolute inset-0 bg-bg-0/88 backdrop-blur-sm" />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="guided-tour-skip-title"
          aria-describedby="guided-tour-skip-copy"
          className="panel relative w-full max-w-[460px] p-6 shadow-raise sm:p-7"
        >
          <p className="label-mono text-amber">Tour preferences</p>
          <h2 id="guided-tour-skip-title" className="mt-2 font-display text-2xl font-semibold text-text-hi">
            Do you want to skip all tours?
          </h2>
          <p id="guided-tour-skip-copy" className="mt-3 text-sm leading-6 text-text-lo">
            You can leave this introduction and still get a short guide the first time you open each workspace page, or turn every tour off now.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => finish(false)}>
              Skip this tour only
            </Button>
            <Button type="button" variant="secondary" onClick={() => finish(true)}>
              Skip all tours
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPhase(phaseBeforeSkipRef.current)}
            >
              Keep touring
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "welcome") {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div aria-hidden className="absolute inset-0 bg-bg-0/85 backdrop-blur-sm" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guided-tour-welcome-title"
          className="panel relative w-full max-w-[520px] overflow-hidden p-6 shadow-raise sm:p-8"
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--ice),white,var(--amber),transparent)]" />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestSkip}
            className="absolute right-4 top-4 rounded-input p-2 text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi"
            aria-label="Skip workspace tour"
          >
            <X className="size-4" />
          </button>

          <div className="flex size-10 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice">
            <Sparkles className="size-4" />
          </div>
          <p className="label-mono mt-6 text-ice">The workspace is open</p>
          <h2
            id="guided-tour-welcome-title"
            className="mt-2 max-w-[13ch] font-display text-3xl font-semibold leading-tight tracking-tight text-text-hi sm:text-4xl"
          >
            Your signal has somewhere to move.
          </h2>
          <p className="mt-4 max-w-[48ch] text-sm leading-6 text-text-lo">
            Take a one-minute pass through the room, or go straight in. You can leave the tour at any point.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                setStepIndex(0);
                setPhase("tour");
              }}
            >
              Show me around <ArrowRight />
            </Button>
            <Button type="button" variant="ghost" onClick={requestSkip}>
              Skip tour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
      <div className="absolute inset-0" aria-hidden />
      {targetRect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[14px] border border-ice/70 shadow-[0_0_0_9999px_rgb(5_5_8_/_0.78),0_0_0_3px_rgb(var(--ice-rgb)_/_0.12),0_0_32px_rgb(var(--ice-rgb)_/_0.3)] transition-[left,top,width,height] duration-300 motion-reduce:transition-none"
          style={{
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-bg-0/80" />
      )}

      <div
        ref={panelRef}
        className={cn(
          "panel fixed w-[min(360px,calc(100vw-32px))] p-5 shadow-raise transition-[left,top] duration-300 motion-reduce:transition-none",
          !targetRect && "border-ice/30"
        )}
        style={{ left: panelPoint.left, top: panelPoint.top }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-mono text-ice">{step.kicker}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-text-lo">
              {String(stepIndex + 1).padStart(2, "0")} / {String(TOUR_STEPS.length).padStart(2, "0")}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestSkip}
            className="rounded-input p-1.5 text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi"
            aria-label="Skip workspace tour"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 id="guided-tour-title" className="mt-4 font-display text-xl font-semibold tracking-tight text-text-hi">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-lo">{step.copy}</p>

        <div className="mt-5 h-px w-full bg-[linear-gradient(90deg,var(--ice),white,var(--amber),transparent)] opacity-40" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={requestSkip} className="text-xs text-text-lo hover:text-text-hi">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setStepIndex((value) => value - 1)}>
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) finish(false);
                else setStepIndex((value) => value + 1);
              }}
            >
              {isLast ? (
                <>
                  Start working <Check />
                </>
              ) : (
                <>
                  Next <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
