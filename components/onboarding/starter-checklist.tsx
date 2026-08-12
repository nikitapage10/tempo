"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Columns3,
  Disc3,
  Music2,
  Radio,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";
import type { StarterChecklistId } from "@/lib/api/member-onboarding";
import { cn } from "@/lib/utils";

const STEPS: {
  id: StarterChecklistId;
  label: string;
  detail: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "review_profile", label: "Review your artist profile", detail: "Make sure the story and identity feel like you.", href: "/artist", icon: UserRound },
  { id: "add_track", label: "Add your first track", detail: "Start with something you’re actively making.", href: "/board?new=1", icon: Disc3 },
  { id: "upload_tune", label: "Upload a tune", detail: "Put a first bounce inside a track workspace.", href: "/tracks", icon: Music2 },
  { id: "shape_board", label: "Shape your board", detail: "Review the stages that match your process.", href: "/board", icon: Columns3 },
  { id: "review_stats", label: "Review your stats", detail: "See what TEMPO can read from your work.", href: "/stats", icon: BarChart3 },
  { id: "connect_spotify", label: "Connect Spotify", detail: "Add your artist link to bring your catalog into view.", href: "/stats#platforms", icon: Radio },
];

export function StarterChecklist() {
  const onboarding = useMemberOnboarding();
  const state = onboarding.data;
  const [expanded, setExpanded] = React.useState(false);
  const opened = React.useRef(false);

  const available = Boolean(
    state?.eligible &&
    state.mainTourCompletedAt &&
    !state.checklistDismissedAt &&
    !state.checklistCompletedAt,
  );

  React.useEffect(() => {
    if (!available || opened.current) return;
    opened.current = true;
    const timer = window.setTimeout(() => {
      setExpanded(true);
      if (!state?.checklistOpenedAt) onboarding.update.mutate({ checklistOpened: true });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [available, onboarding.update, state?.checklistOpenedAt]);

  if (!available || !state) return null;
  const done = new Set(state.checklistSteps);
  const progress = Math.round((done.size / STEPS.length) * 100);

  function toggle(id: StarterChecklistId) {
    const next = done.has(id)
      ? state!.checklistSteps.filter((step) => step !== id)
      : [...state!.checklistSteps, id];
    onboarding.update.mutate({ checklistSteps: next });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed right-4 top-24 z-[55] flex items-center gap-2 rounded-full border border-ice/30 bg-bg-1 px-3 py-2 text-xs text-text-hi shadow-e3 transition-colors hover:bg-bg-2 max-md:bottom-20 max-md:top-auto"
      >
        <ClipboardCheck className="size-4 text-ice" />
        Getting started · {done.size}/{STEPS.length}
      </button>
    );
  }

  return (
    <aside className="fixed right-4 top-24 z-[55] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3 max-md:bottom-20 max-md:top-auto">
      <div className="border-b border-line p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice">
            <ClipboardCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-mono text-ice">Your first moves</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-text-hi">Bring the workspace to life.</h2>
          </div>
          <button type="button" onClick={() => setExpanded(false)} className="rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-text-hi" aria-label="Close getting started checklist">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-2">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--ice),var(--amber))] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-text-lo">{progress}%</span>
        </div>
      </div>

      <div className="max-h-[min(28rem,58vh)] overflow-y-auto p-2">
        {STEPS.map((step) => {
          const complete = done.has(step.id);
          const Icon = step.icon;
          return (
            <div key={step.id} className={cn("group flex items-center gap-2 rounded-input p-2 transition-colors hover:bg-bg-2", complete && "opacity-60")}>
              <button
                type="button"
                onClick={() => toggle(step.id)}
                disabled={onboarding.update.isPending}
                className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", complete ? "border-ok bg-ok text-bg-0" : "border-line text-transparent hover:border-ice")}
                aria-label={complete ? `Mark ${step.label} incomplete` : `Mark ${step.label} complete`}
              >
                <Check className="size-3" />
              </button>
              <Icon className="size-4 shrink-0 text-text-lo" />
              <Link href={step.href} className="min-w-0 flex-1" onClick={() => setExpanded(false)}>
                <p className={cn("text-sm text-text-hi", complete && "line-through")}>{step.label}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-text-lo">{step.detail}</p>
              </Link>
              <ChevronRight className="size-4 shrink-0 text-text-lo transition-transform group-hover:translate-x-0.5 group-hover:text-ice" />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <p className="text-xs text-text-lo">Check items off at your own pace.</p>
        <Button type="button" size="sm" variant="ghost" onClick={() => onboarding.update.mutate({ checklistDismissed: true })} disabled={onboarding.update.isPending}>
          Remove
        </Button>
      </div>
    </aside>
  );
}
