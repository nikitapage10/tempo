"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";
import { APP_VERSION } from "@/lib/version";

const HIGHLIGHTS = [
  "Artist Origin and a guided first arrival",
  "Tracks, projects, tasks, calendar, and a customizable board",
  "Private bounce uploads, comments, decisions, and guest review links",
  "Artist profiles, messaging, social discovery, scenes, and statistics",
];

export default function BetaPage() {
  const onboarding = useMemberOnboarding();
  const state = onboarding.data;
  const checklistProgress = state
    ? `${state.checklistSteps.length} of 6 complete`
    : "Loading progress";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="TEMPO Beta"
        subtitle={`Private beta · version ${APP_VERSION}`}
      />

      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--ice),white,var(--amber),transparent)]"
        />
        <div className="flex size-11 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice">
          <FlaskConical className="size-5" />
        </div>
        <p className="label-mono mt-6 text-ice">You’re early</p>
        <h1 className="mt-2 max-w-[18ch] font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-4xl">
          Help shape the room while the signal is still forming.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-text-lo">
          TEMPO is in private beta. The core workspace is ready for real music,
          but some edges will keep changing as members use it. Your catalog stays
          private unless you deliberately publish or share something.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Return to Today <ArrowRight /></Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/messages">Message Nikita <MessageCircle /></Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel-quiet p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-ice" />
            <p className="label-mono">In this build</p>
          </div>
          <ul className="mt-4 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-6 text-text-lo">
                <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-ok" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-quiet p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber" />
            <p className="label-mono">Beta expectations</p>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-text-lo">
            <p>Features and layouts may change between versions. TEMPO will keep your creative work private and avoid silently publishing or sharing it.</p>
            <p>General email notifications are still limited. Spotify and Apple Music connections can show catalog information, not private artist analytics or stream counts.</p>
            <p>If something feels confusing, that is useful feedback—not user error. Use Feedback in the left rail or reply to Nikita’s welcome message.</p>
          </div>
        </section>
      </div>

      {state?.eligible ? (
        <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label-mono text-ice">Getting started</p>
            <p className="mt-2 text-sm text-text-hi">
              {state.checklistCompletedAt ? "Your starter checklist is complete." : checklistProgress}
            </p>
            <p className="mt-1 text-xs text-text-lo">The checklist stays alongside the workspace until you finish or remove it.</p>
          </div>
          {!state.checklistCompletedAt ? (
            <Button
              variant="secondary"
              disabled={onboarding.update.isPending}
              onClick={() => onboarding.update.mutate({ checklistDismissed: false, checklistOpened: true })}
            >
              <RotateCcw /> Show checklist
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
