"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { validateArtistName } from "@/lib/origin/validation";
import { cn } from "@/lib/utils";

/** Frame 2 — the artist gives the room a name to hold onto. */
export function OriginNameStep({
  name,
  onNameChange,
  onBack,
  onSubmit,
  mediaReady,
  busy,
  active = true,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  mediaReady: boolean;
  busy: boolean;
  /** False while this is fading in under a still-playing transition. */
  active?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorId = "origin-name-error";

  React.useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [active]);

  const waiting = attempted && !mediaReady;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validateArtistName(name);
    if (!result.ok) {
      setError(result.message);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setAttempted(true);
    if (mediaReady) onSubmit();
  }

  React.useEffect(() => {
    if (attempted && mediaReady && !error) onSubmit();
  }, [attempted, mediaReady, error, onSubmit]);

  return (
    <OriginScrim className="pointer-events-auto relative w-full max-w-lg overflow-hidden p-0 text-left">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-80 shadow-[0_0_24px_var(--ice)]"
      />
      <span
        aria-hidden
        className="absolute -right-16 -top-20 size-56 rounded-full border border-ice/10 bg-ice/[0.035] blur-sm"
      />

      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col gap-8 px-7 py-8 sm:px-9 sm:py-10"
      >
        <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.28em] text-text-lo/70">
          <span>Signal / 01</span>
          <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--line),transparent)]" />
          <span>In your words</span>
        </div>

        <div className="flex flex-col gap-3">
          <MorphingText
            as="h1"
            texts={["What name does the work answer to?"]}
            loop={false}
            className="font-display text-4xl leading-none text-text-hi sm:text-5xl [&>span]:text-left"
          />
          <p className="max-w-sm text-sm leading-relaxed text-text-lo">
            Choose the artist or project name you want to carry forward.
          </p>
        </div>

        <div className="relative flex flex-col gap-2 border-b border-line/80 pb-2 focus-within:border-ice/70">
          <label htmlFor="origin-name" className="sr-only">
            Artist name
          </label>
          <Input
            id="origin-name"
            ref={inputRef}
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Artist Name"
            autoComplete="off"
            maxLength={60}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-2 font-display text-2xl tracking-[0.03em] text-text-hi shadow-none placeholder:tracking-normal focus-visible:ring-0 sm:text-3xl"
          />
          <span
            aria-hidden
            className="absolute bottom-[-1px] left-0 h-px w-16 bg-ice shadow-[0_0_12px_var(--ice)]"
          />
          {error ? (
            <p id={errorId} role="alert" className="text-xs text-warn">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-text-lo transition-colors hover:text-text-hi"
          >
            <ChevronLeft className="size-3.5" /> Back
          </button>
          <button
            type="submit"
            disabled={busy}
            className={cn(
              "group flex items-center gap-3 rounded-full border border-line/80 bg-white/[0.035] py-1.5 pl-4 pr-1.5 text-sm text-text-hi transition-colors hover:border-ice/50 hover:bg-ice/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-60",
              waiting && "cursor-wait"
            )}
          >
            <span>{waiting ? "One moment…" : "Name the signal"}</span>
            <span className="flex size-9 items-center justify-center rounded-full bg-ice text-bg-0 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </form>
    </OriginScrim>
  );
}
