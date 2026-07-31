"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  name: string;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  mediaReady: boolean;
  busy: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorId = "origin-name-error";

  // Focus lands here once the opening has handed off, not before — otherwise
  // the keyboard opens over a film the artist is still watching.
  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

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
    <OriginScrim className="pointer-events-auto w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl text-text-hi">Who are you?</h1>
          <p className="text-sm text-text-lo">
            The name you release music under. You can change it whenever you like.
          </p>
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
            placeholder="Artist name"
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

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-text-lo hover:text-text-hi"
          >
            Skip for now
          </Button>

          <Button type="submit" disabled={busy} className={cn(waiting && "cursor-wait")}>
            {waiting ? "One moment…" : "Continue"}
          </Button>
        </div>
      </form>
    </OriginScrim>
  );
}
