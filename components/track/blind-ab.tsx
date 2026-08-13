"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useDecisionMutations } from "@/hooks/use-decisions";
import { useVersions } from "@/hooks/use-versions";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { DECISION_AREAS, DECISION_TYPES } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";
import type { DecisionArea, DecisionType, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

type BlindABProps = {
  trackId: string;
  versionAId: string;
  versionBId: string;
  onClose: () => void;
};

type Choice = "A" | "B" | "none" | null;

/** Randomizes once per mount so mount order can't leak which version is which. */
function useRandomMapping(idOne: string, idTwo: string) {
  return React.useMemo(() => {
    const swap = Math.random() < 0.5;
    return { A: swap ? idTwo : idOne, B: swap ? idOne : idTwo };
  }, [idOne, idTwo]);
}

/**
 * Blind A/B comparison (FEATURE-SPECS §8). Labels stay hidden until the
 * musician chooses; playback is one-at-a-time with independent volume and a
 * shared best-effort seek bar — this is not claimed to be sample-accurate
 * sync, just a convenient shared scrub position across two <audio> tags.
 */
export function BlindAB({
  trackId,
  versionAId,
  versionBId,
  onClose,
}: BlindABProps) {
  const mapping = useRandomMapping(versionAId, versionBId);
  const { data: versions = [] } = useVersions(trackId);
  const { create: createDecision } = useDecisionMutations(trackId);
  const { toast } = useToast();

  const versionA = versions.find((v) => v.id === mapping.A) ?? null;
  const versionB = versions.find((v) => v.id === mapping.B) ?? null;

  const [choice, setChoice] = React.useState<Choice>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const [decisionForId, setDecisionForId] = React.useState<string | null>(
    null
  );

  const sideARef = React.useRef<HTMLAudioElement>(null);
  const sideBRef = React.useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = React.useState<"A" | "B" | null>(null);
  const [volumeA, setVolumeA] = React.useState(1);
  const [volumeB, setVolumeB] = React.useState(1);
  const [time, setTime] = React.useState(0);
  const [durationA, setDurationA] = React.useState(0);
  const [durationB, setDurationB] = React.useState(0);
  const [srcA, setSrcA] = React.useState<string | null>(null);
  const [srcB, setSrcB] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (versionA) {
      getSignedUrl(versionA.file_url)
        .then((url) => {
          if (!cancelled) setSrcA(url);
        })
        .catch(() => {
          if (!cancelled)
            setLoadError("Couldn’t load one of the bounces — try again.");
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionA?.file_url]);

  React.useEffect(() => {
    let cancelled = false;
    if (versionB) {
      getSignedUrl(versionB.file_url)
        .then((url) => {
          if (!cancelled) setSrcB(url);
        })
        .catch(() => {
          if (!cancelled)
            setLoadError("Couldn’t load one of the bounces — try again.");
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionB?.file_url]);

  React.useEffect(() => {
    return playbackCoordinator.register("blind-ab", () => {
      sideARef.current?.pause();
      sideBRef.current?.pause();
      setPlaying(null);
    });
  }, []);

  React.useEffect(() => {
    if (sideARef.current) sideARef.current.volume = volumeA;
  }, [volumeA]);

  React.useEffect(() => {
    if (sideBRef.current) sideBRef.current.volume = volumeB;
  }, [volumeB]);

  function playSide(side: "A" | "B") {
    const mine = side === "A" ? sideARef.current : sideBRef.current;
    const other = side === "A" ? sideBRef.current : sideARef.current;
    if (!mine) return;
    other?.pause();
    playbackCoordinator.notifyPlay("blind-ab");
    // Re-apply the shared scrub position on play. Desktop vault URLs historically
    // dropped seeks until Range responses landed; even with that fixed, play()
    // can still race metadata and snap to 0 without this.
    const seekTo = time;
    if (Number.isFinite(seekTo) && seekTo > 0) {
      try {
        mine.currentTime = seekTo;
      } catch {
        /* ignore — some engines throw before HAVE_METADATA */
      }
    }
    void mine.play().then(() => {
      if (
        Number.isFinite(seekTo) &&
        seekTo > 0 &&
        Math.abs(mine.currentTime - seekTo) > 0.35
      ) {
        try {
          mine.currentTime = seekTo;
        } catch {
          /* ignore */
        }
      }
    });
    setPlaying(side);
  }

  function pauseSide(side: "A" | "B") {
    const mine = side === "A" ? sideARef.current : sideBRef.current;
    mine?.pause();
    setPlaying((p) => (p === side ? null : p));
    playbackCoordinator.notifyStop("blind-ab");
  }

  function handleSeek(next: number) {
    setTime(next);
    if (sideARef.current) sideARef.current.currentTime = next;
    if (sideBRef.current) sideBRef.current.currentTime = next;
  }

  const maxDuration = Math.max(durationA, durationB, 1);
  const winnerVersion =
    choice === "A" ? versionA : choice === "B" ? versionB : null;

  function chooseAndReveal(next: Choice) {
    sideARef.current?.pause();
    sideBRef.current?.pause();
    setPlaying(null);
    setChoice(next);
    setRevealed(true);
    setDecisionForId(
      next === "A" ? mapping.A : next === "B" ? mapping.B : mapping.A
    );
  }

  if (!versionA || !versionB) {
    return (
      <p className="text-sm text-text-lo">
        Couldn’t find both versions to compare.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-lo">
        Labels are randomized and hidden until you choose. Seeking moves both
        players to roughly the same spot — this is a convenient shared scrub
        position, not sample-perfect sync.
      </p>

      {loadError ? <p className="text-sm text-warn">{loadError}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <BlindSide
          label="A"
          revealedLabel={
            revealed
              ? `v${versionA.version_no}${versionA.label ? ` — ${versionA.label}` : ""}`
              : null
          }
          playing={playing === "A"}
          volume={volumeA}
          onVolume={setVolumeA}
          onPlayPause={() =>
            playing === "A" ? pauseSide("A") : playSide("A")
          }
          disabled={!srcA}
          isChoice={revealed && choice === "A"}
        />
        <BlindSide
          label="B"
          revealedLabel={
            revealed
              ? `v${versionB.version_no}${versionB.label ? ` — ${versionB.label}` : ""}`
              : null
          }
          playing={playing === "B"}
          volume={volumeB}
          onVolume={setVolumeB}
          onPlayPause={() =>
            playing === "B" ? pauseSide("B") : playSide("B")
          }
          disabled={!srcB}
          isChoice={revealed && choice === "B"}
        />
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={maxDuration}
          step={0.1}
          value={Math.min(time, maxDuration)}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full accent-[var(--ice)]"
          aria-label="Shared seek position"
        />
        <p className="font-mono text-xs text-text-lo">
          {formatDuration(time)} / {formatDuration(maxDuration)}
        </p>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={sideARef}
        src={srcA ?? undefined}
        onLoadedMetadata={(e) => setDurationA(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          if (playing === "A") setTime(e.currentTarget.currentTime);
        }}
        onEnded={() => setPlaying(null)}
        onError={() => setLoadError("Couldn’t load bounce A — try again.")}
        className="hidden"
      />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={sideBRef}
        src={srcB ?? undefined}
        onLoadedMetadata={(e) => setDurationB(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          if (playing === "B") setTime(e.currentTarget.currentTime);
        }}
        onEnded={() => setPlaying(null)}
        onError={() => setLoadError("Couldn’t load bounce B — try again.")}
        className="hidden"
      />

      {!revealed ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button type="button" onClick={() => chooseAndReveal("A")} disabled={!srcA}>
            Prefer A
          </Button>
          <Button type="button" onClick={() => chooseAndReveal("B")} disabled={!srcB}>
            Prefer B
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => chooseAndReveal("none")}
          >
            No preference
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Leave without choosing
          </Button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-sm text-text-hi">
            {choice === "none" ? (
              "No preference recorded."
            ) : (
              <>
                You preferred{" "}
                <span className="font-medium text-ice">
                  v{winnerVersion?.version_no}
                  {winnerVersion?.label ? ` — ${winnerVersion.label}` : ""}
                </span>
              </>
            )}
          </p>
          <p className="font-mono text-xs text-text-lo">
            A was v{versionA.version_no} · B was v{versionB.version_no}
          </p>
          {!decisionOpen ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDecisionOpen(true)}
              >
                Record a decision
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <ABDecisionForm
              versionA={versionA}
              versionB={versionB}
              defaultVersionId={decisionForId ?? versionA.id}
              onCancel={() => setDecisionOpen(false)}
              onSave={async (input) => {
                try {
                  await createDecision.mutateAsync(input);
                  toast("Decision recorded", "ok");
                  onClose();
                } catch (err) {
                  toast(
                    err instanceof Error
                      ? err.message
                      : "Couldn’t save that decision."
                  );
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function BlindSide({
  label,
  revealedLabel,
  playing,
  volume,
  onVolume,
  onPlayPause,
  disabled,
  isChoice,
}: {
  label: "A" | "B";
  revealedLabel: string | null;
  playing: boolean;
  volume: number;
  onVolume: (v: number) => void;
  onPlayPause: () => void;
  disabled: boolean;
  isChoice: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-3",
        isChoice ? "border-ice/50 bg-ice/5" : "border-line bg-bg-2/50"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-text-hi">
          Bounce {label}
        </span>
        {isChoice ? (
          <span className="font-mono text-[11px] uppercase tracking-wider text-ice">
            your pick
          </span>
        ) : null}
      </div>
      {revealedLabel ? (
        <p className="mb-2 font-mono text-xs text-text-lo">{revealedLabel}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onPlayPause}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ice text-bg-0 transition-opacity duration-hover hover:opacity-90 disabled:opacity-40"
          aria-label={playing ? `Pause bounce ${label}` : `Play bounce ${label}`}
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="size-4 translate-x-px" fill="currentColor" />
          )}
        </button>
        <label className="flex flex-1 items-center gap-2 text-xs text-text-lo">
          Vol
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="flex-1 accent-[var(--ice)]"
            aria-label={`Bounce ${label} volume`}
          />
        </label>
      </div>
    </div>
  );
}

function ABDecisionForm({
  versionA,
  versionB,
  defaultVersionId,
  onCancel,
  onSave,
}: {
  versionA: Version;
  versionB: Version;
  defaultVersionId: string;
  onCancel: () => void;
  onSave: (input: {
    versionId: string;
    decisionType: DecisionType;
    decisionArea: DecisionArea;
    note?: string | null;
  }) => Promise<void>;
}) {
  const [versionId, setVersionId] = React.useState(defaultVersionId);
  const [type, setType] = React.useState<DecisionType>("approved");
  const [area, setArea] = React.useState<DecisionArea>("general");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({
            versionId,
            decisionType: type,
            decisionArea: area,
            note: note || null,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <Label htmlFor="ab-decision-version">About which version?</Label>
        <select
          id="ab-decision-version"
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          <option value={versionA.id}>
            v{versionA.version_no}
            {versionA.label ? ` — ${versionA.label}` : ""}
          </option>
          <option value={versionB.id}>
            v{versionB.version_no}
            {versionB.label ? ` — ${versionB.label}` : ""}
          </option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {DECISION_TYPES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setType(d.value)}
            className={cn(
              "rounded-chip border px-3 py-1.5 text-xs transition-colors duration-hover",
              type === d.value
                ? "border-ice/50 bg-ice/15 text-ice"
                : "border-line bg-bg-2 text-text-lo hover:text-text-hi"
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <select
        value={area}
        onChange={(e) => setArea(e.target.value as DecisionArea)}
        className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        aria-label="Decision area"
      >
        {DECISION_AREAS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Why this one…"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save decision"}
        </Button>
      </div>
    </form>
  );
}
