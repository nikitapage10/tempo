"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MorphingText } from "@/components/ui/morphing-text";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { validateArtistName } from "@/lib/origin/validation";
import { cn } from "@/lib/utils";

/**
 * Frame 2 — the artist says who they are.
 *
 * The Continue action is gated on the next step's media being ready. When it
 * isn't, the loop simply keeps running and the button shows a restrained
 * pending state; the artist is never shown a browser spinner and never lands on
 * an unbuffered transition.
 */
export function OriginNameStep({
  name,
  onNameChange,
  onSubmit,
  onSkip,
  mediaReady,
  busy,
  active = true,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  mediaReady: boolean;
  busy: boolean;
  /** False while this is fading in under a still-playing transition. */
  active?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorId = "origin-name-error";

  // Focus lands here once the opening has handed off, not before — otherwise
  // a mobile keyboard opens over a film the artist is still watching.
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

  // Once the media catches up, an artist who already pressed Continue moves on
  // without having to press it again.
  React.useEffect(() => {
    if (attempted && mediaReady && !error) onSubmit();
  }, [attempted, mediaReady, error, onSubmit]);

  return (
    <OriginScrim className="pointer-events-auto min-h-[17.5rem] w-full max-w-md text-left">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <MorphingText
            as="h1"
            texts={["Who are you?"]}
            loop={false}
            className="font-display text-3xl text-text-hi sm:text-4xl [&>span]:text-left"
          />
          <p className="text-sm text-text-lo">Give me something to call you by.</p>
        </div>

        <div className="flex flex-col gap-2">
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
            placeholder="The name on the record"
            autoComplete="off"
            maxLength={60}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="h-11 text-base"
          />
          {error ? (
            <p id={errorId} role="alert" className="text-xs text-warn">
              {error}
            </p>
          ) : null}
        </div>

        {/* No skip here: everything after this point is built from the name,
            so there is nothing meaningful to skip *to*. */}
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={busy} className={cn(waiting && "cursor-wait")}>
            {waiting ? "One moment…" : "Continue"}
          </Button>
        </div>
      </form>
    </OriginScrim>
  );
}
