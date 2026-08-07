"use client";

import * as React from "react";
import { Check, ChevronDown, Pencil, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { ORIGIN_LIMITS } from "@/lib/origin/validation";
import type {
  ArtistOriginInterpretation,
  IdentitySignal,
} from "@/lib/origin/types";
import { cn } from "@/lib/utils";

/**
 * Frame 5 — the artist reads what TEMPO heard, and corrects it.
 *
 * Everything here is editable, because the interpretation is a draft of the
 * artist's own story rather than a finding about them. Confidence is shown as a
 * word, never a number: a percentage would imply a precision that doesn't exist.
 */

const CONFIDENCE_LABEL: Record<IdentitySignal["confidence"], string> = {
  high: "You said this plainly",
  medium: "A fair reading",
  low: "A tentative pattern",
};

function ConfidenceChip({ confidence }: { confidence: IdentitySignal["confidence"] }) {
  return (
    <span
      className={cn(
        "rounded-chip border px-2 py-0.5 text-[11px] leading-none",
        confidence === "high"
          ? "border-ice/40 text-ice"
          : confidence === "medium"
            ? "border-line text-text-lo"
            : "border-line/60 text-text-lo/70"
      )}
    >
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

function SignalCard({
  signal,
  onChange,
  onRemove,
}: {
  signal: IdentitySignal;
  onChange: (next: IdentitySignal) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  return (
    <li className="well flex flex-col gap-2 rounded-card border border-line/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <Input
            value={signal.label}
            onChange={(e) => onChange({ ...signal, label: e.target.value })}
            maxLength={ORIGIN_LIMITS.signalLabel}
            className="h-8 flex-1"
            aria-label="Signal name"
          />
        ) : (
          <h3 className="font-display text-base text-text-hi">{signal.label}</h3>
        )}
        <ConfidenceChip confidence={signal.confidence} />
      </div>

      {editing ? (
        <Textarea
          value={signal.explanation}
          onChange={(e) => onChange({ ...signal, explanation: e.target.value })}
          maxLength={ORIGIN_LIMITS.signalText}
          rows={3}
          className="resize-none text-sm"
          aria-label="What this means"
        />
      ) : (
        <p className="text-sm leading-relaxed text-text-lo">{signal.explanation}</p>
      )}

      {signal.evidence ? (
        <p className="border-l border-line pl-3 text-xs italic leading-relaxed text-text-lo/80">
          {signal.evidence}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 pt-1">
        <Button
          type="button"
          size="sm"
          variant={confirmed ? "secondary" : "ghost"}
          onClick={() => setConfirmed((v) => !v)}
          aria-pressed={confirmed}
        >
          <Check /> That&rsquo;s me
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          <Pencil /> {editing ? "Done" : "Edit"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="text-text-lo hover:text-warn"
        >
          <X /> Remove
        </Button>
      </div>
    </li>
  );
}

export function OriginReviewStep({
  interpretation,
  pending,
  canUndo,
  onChange,
  onUndo,
  onRegenerate,
  onAcceptPending,
  onDiscardPending,
  onOpenChapter,
  mediaReady,
  mediaProgress,
  busy,
  error,
}: {
  interpretation: ArtistOriginInterpretation;
  pending: ArtistOriginInterpretation | null;
  canUndo: boolean;
  onChange: (next: ArtistOriginInterpretation) => void;
  onUndo: () => void;
  onRegenerate: () => void;
  onAcceptPending: () => void;
  onDiscardPending: () => void;
  onOpenChapter: () => void;
  mediaReady: boolean;
  mediaProgress: number;
  busy: boolean;
  error: string | null;
}) {
  const [attempted, setAttempted] = React.useState(false);
  const waiting = attempted && !mediaReady;

  React.useEffect(() => {
    if (attempted && mediaReady) onOpenChapter();
  }, [attempted, mediaReady, onOpenChapter]);

  const patch = (p: Partial<ArtistOriginInterpretation>) =>
    onChange({ ...interpretation, ...p });

  return (
    <OriginScrim className="pointer-events-auto relative max-h-[82vh] w-full max-w-2xl overflow-hidden bg-[rgb(10_10_12/0.82)] p-0">
      <div
        className="no-scrollbar flex max-h-[82vh] flex-col gap-5 overflow-y-auto p-6 pb-16"
      >
      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-[0.28em] text-text-hi/80">
          Focus / a first reading
        </p>
        <h1 className="font-display text-3xl text-text-hi sm:text-4xl">
          A first shape.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-hi/90">
          These are the things TEMPO heard more than once. They don&rsquo;t define
          you. They show where your energy is gathering right now.
        </p>
      </div>

      {pending ? (
        <div className="rounded-card border border-ice/40 bg-bg-2/60 p-4">
          <p className="text-sm text-text-hi">
            Another interpretation is ready. Your current one is untouched until you choose.
          </p>
          <p className="mt-2 text-sm italic leading-relaxed text-text-lo">
            {pending.artistPromise}
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={onAcceptPending}>
              Use this one
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDiscardPending}>
              Keep what I have
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-card border border-line/70 bg-white/[0.025] px-5 py-6">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)]"
        />
        <p className="text-xs uppercase tracking-[0.22em] text-text-hi/80">
          The spectrum coming through
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {interpretation.identitySignals.slice(0, 5).map((signal, index) => (
            <span
              key={`${signal.label}-${index}`}
              className={cn(
                "rounded-full border px-3 py-1.5 font-display text-sm",
                index % 3 === 0
                  ? "border-ice/35 bg-ice/[0.055] text-ice"
                  : index % 3 === 1
                    ? "border-amber/30 bg-amber/[0.045] text-text-hi"
                    : "border-line/80 bg-white/[0.025] text-text-hi"
              )}
            >
              {signal.label}
            </span>
          ))}
        </div>
      </div>

      <details className="group rounded-card border border-line/60 bg-bg-0/25">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice">
          <span>Bring the reading closer</span>
          <ChevronDown className="size-4 text-text-lo transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-5 border-t border-line/60 p-4">
      <section className="flex flex-col gap-2">
        <label htmlFor="origin-promise" className="text-xs uppercase tracking-wide text-text-lo">
          The spark
        </label>
        <Textarea
          id="origin-promise"
          value={interpretation.artistPromise}
          onChange={(e) => patch({ artistPromise: e.target.value })}
          maxLength={ORIGIN_LIMITS.promise}
          rows={2}
          className="resize-none text-base leading-relaxed"
        />
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="origin-compass" className="text-xs uppercase tracking-wide text-text-lo">
          The pull
        </label>
        <Textarea
          id="origin-compass"
          value={interpretation.creativeCompass}
          onChange={(e) => patch({ creativeCompass: e.target.value })}
          maxLength={ORIGIN_LIMITS.compass}
          rows={4}
          className="resize-none text-sm leading-relaxed"
        />
      </section>

      {interpretation.identitySignals.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-text-lo">The spectrum</h2>
          <ul className="flex flex-col gap-3">
            {interpretation.identitySignals.map((signal, i) => (
              <SignalCard
                key={`${signal.label}-${i}`}
                signal={signal}
                onChange={(next) => {
                  const signals = [...interpretation.identitySignals];
                  signals[i] = next;
                  patch({ identitySignals: signals });
                }}
                onRemove={() =>
                  patch({
                    identitySignals: interpretation.identitySignals.filter((_, j) => j !== i),
                  })
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-text-lo">
          Where the light is pointing
        </h2>
        <Input
          value={interpretation.currentChapter.title}
          onChange={(e) =>
            patch({
              currentChapter: { ...interpretation.currentChapter, title: e.target.value },
            })
          }
          maxLength={ORIGIN_LIMITS.chapterTitle}
          aria-label="Chapter title"
          className="font-display"
        />
        <Textarea
          value={interpretation.currentChapter.premise}
          onChange={(e) =>
            patch({
              currentChapter: { ...interpretation.currentChapter, premise: e.target.value },
            })
          }
          maxLength={ORIGIN_LIMITS.chapterPremise}
          rows={3}
          aria-label="Chapter premise"
          className="resize-none text-sm leading-relaxed"
        />
      </section>

      {interpretation.suggestedGenres.length > 0 || interpretation.suggestedRoles.length > 0 ? (
        <section className="flex flex-wrap gap-1.5">
          {[...interpretation.suggestedGenres, ...interpretation.suggestedRoles].map((tag) => (
            <span
              key={tag}
              className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo"
            >
              {tag}
            </span>
          ))}
        </section>
      ) : null}
        </div>
      </details>

      {error ? (
        <p role="alert" className="text-xs text-warn">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onRegenerate} disabled={busy}>
          See another reading
        </Button>
        {canUndo ? (
          <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
            <Undo2 /> Undo
          </Button>
        ) : null}

        <div className="ml-auto flex flex-col items-end gap-1">
          <Button
            type="button"
            onClick={() => setAttempted(true)}
            disabled={busy || waiting}
            className={cn(waiting && "cursor-wait")}
          >
            {waiting ? "Bringing it into focus…" : "Bring it into focus"}
          </Button>
          {waiting ? (
            <div
              className="h-px w-36 overflow-hidden bg-line"
              role="progressbar"
              aria-label="Preparing your chapter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(mediaProgress * 100)}
            >
              <div
                className="h-full bg-ice transition-[width] duration-500"
                style={{ width: `${Math.round(mediaProgress * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
      </div>

    </OriginScrim>
  );
}
