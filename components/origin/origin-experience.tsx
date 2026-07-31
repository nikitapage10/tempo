"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OriginMediaStage } from "@/components/origin/origin-media-stage";
import { OriginOverlay, TimedCopy } from "@/components/origin/origin-copy-layer";
import { OriginNameStep } from "@/components/origin/origin-name-step";
import { OriginIntroductionStep } from "@/components/origin/origin-introduction-step";
import {
  OriginInterpretationError,
  OriginProcessingStep,
} from "@/components/origin/origin-processing-step";
import { OriginReviewStep } from "@/components/origin/origin-review-step";
import { OriginStoryScroll } from "@/components/origin/origin-story-scroll";
import { markFirstOpenPending } from "@/components/origin/first-open-reveal";
import { PHASE_GATES, useOriginMedia } from "@/hooks/use-origin-media";
import { useOriginState } from "@/hooks/use-origin-state";
import { clipForPhase } from "@/lib/origin/reducer";
import { originAsset, type OriginMediaKey } from "@/lib/origin/media";
import { applyOriginToProfile } from "@/lib/origin/profile-mapping";

/**
 * ORIGIN, assembled.
 *
 * This component only orchestrates: the state machine decides what phase we are
 * in, the media hook decides what is loaded, the stage decides what is on
 * screen, and the step components own their own interactions. Nothing here
 * reaches into any of those directly.
 */

/** Where an artist goes after Origin, depending on whether Import is still due. */
const IMPORT_ROUTE = "/import";
const HOME_ROUTE = "/";

const OPENING_LINES = [
  { text: "Every story begins with a pulse.", at: 0.04, until: 0.38 },
  { text: "There's someone in the noise.", at: 0.4, until: 0.74 },
  { text: "Who are you?", at: 0.78 },
];

export function OriginExperience({
  importPending,
  revisit = false,
}: {
  importPending: boolean;
  revisit?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    state,
    dispatch,
    artistId,
    hydrated,
    runInterpretation,
    regenerate,
    complete,
    skip,
    setInterpretation,
  } = useOriginState(revisit);

  const media = useOriginMedia(state.phase);
  const [useForProfile, setUseForProfile] = React.useState(false);

  /** The element currently on screen, so copy timing and scrubbing can read it. */
  const activeVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const handleActiveElement = React.useCallback(
    (el: HTMLVideoElement | null) => {
      activeVideoRef.current = el;
    },
    []
  );

  const clip = clipForPhase(state.phase);
  const poster = clip ? originAsset(clip.key).poster : undefined;

  /** Kick off interpretation the moment the artist finishes speaking — in
   *  parallel with the transition, never gated on it. */
  const interpretationStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (state.phase !== "interpreting_transition" && state.phase !== "processing") {
      interpretationStartedRef.current = false;
      return;
    }
    if (interpretationStartedRef.current) return;
    interpretationStartedRef.current = true;
    runInterpretation();
  }, [state.phase, runInterpretation]);

  /** Transitions advance on their own `ended` event. */
  const handleEnded = React.useCallback(() => {
    switch (state.phase) {
      case "opening":
        dispatch({ type: "opening_ended" });
        break;
      case "recognizing":
        dispatch({ type: "recognition_ended" });
        break;
      case "interpreting_transition":
        dispatch({ type: "transition_ended" });
        break;
      case "resolving":
        dispatch({ type: "resolve_ended" });
        break;
      case "chapter_opening":
        dispatch({ type: "chapter_ended" });
        break;
      default:
        break;
    }
  }, [state.phase, dispatch]);

  /** A failed asset must not strand the artist mid-flow — advance as if it played. */
  const handleMediaError = React.useCallback(
    (key: OriginMediaKey) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[origin] falling back past ${key}`);
      }
      handleEnded();
    },
    [handleEnded]
  );

  const gateFor = (phase: Parameters<typeof clipForPhase>[0]) => PHASE_GATES[phase] ?? [];

  async function handleEnter() {
    const ok = await complete();
    if (!ok) return;

    if (useForProfile && artistId) {
      // Never blocks entry, and never changes visibility — see profile-mapping.
      await applyOriginToProfile(artistId, state.interpretation, state.name).catch(
        () => {}
      );
    }

    await queryClient.invalidateQueries({ queryKey: ["artists"] });
    await queryClient.invalidateQueries({ queryKey: ["artist-profile", artistId] });

    markFirstOpenPending();
    router.replace(importPending ? IMPORT_ROUTE : HOME_ROUTE);
  }

  async function handleSkip() {
    await skip();
    markFirstOpenPending();
    router.replace(importPending ? IMPORT_ROUTE : HOME_ROUTE);
  }

  if (!hydrated) {
    // Deep black rather than a spinner — the film opens from here.
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

  const storyPhase =
    state.phase === "story_scroll" || state.phase === "saving" || state.phase === "complete";

  return (
    <OriginMediaStage
      clip={clip}
      posterSrc={poster}
      staticMode={media.staticMode}
      onEnded={handleEnded}
      onError={handleMediaError}
      onActiveElement={handleActiveElement}
    >
      {/* The story owns the whole scroll range, so it sits outside the centred
          overlay the other steps share. */}
      {storyPhase ? (
        <div className="absolute inset-0 overflow-y-auto">
          <OriginStoryScroll
            interpretation={state.interpretation}
            staticMode={media.staticMode}
            videoRef={activeVideoRef}
            onEnter={handleEnter}
            onBack={() => dispatch({ type: "resolve_ended" })}
            busy={state.busy}
            error={state.error}
            importPending={importPending}
            useForProfile={useForProfile}
            onUseForProfileChange={setUseForProfile}
          />
        </div>
      ) : (
        <OriginOverlay>
          {state.phase === "opening" ? (
            <TimedCopy
              lines={OPENING_LINES}
              videoRef={activeVideoRef}
              showAll={media.staticMode}
            />
          ) : null}

          {state.phase === "name_idle" ? (
            <OriginNameStep
              name={state.name}
              onNameChange={(name) => dispatch({ type: "set_name", name })}
              onSubmit={() => dispatch({ type: "submit_name" })}
              onSkip={handleSkip}
              mediaReady={media.gateOpen(gateFor("recognizing"))}
              busy={state.busy}
            />
          ) : null}

          {state.phase === "recognizing" ? (
            <TimedCopy
              lines={[
                { text: `${state.name}.`, at: 0.08, until: 0.5 },
                { text: "Good. I can see you now.", at: 0.54 },
              ]}
              videoRef={activeVideoRef}
              showAll={media.staticMode}
            />
          ) : null}

          {state.phase === "introduction_idle" || state.phase === "recording" ? (
            <OriginIntroductionStep
              introduction={state.introduction}
              onIntroductionChange={(text) => dispatch({ type: "set_introduction", text })}
              onFinish={() => dispatch({ type: "finish_introduction" })}
              onRecordingChange={(recording) =>
                dispatch({ type: recording ? "start_recording" : "stop_recording" })
              }
              mediaReady={media.gateOpen(gateFor("interpreting_transition"))}
              busy={state.busy}
            />
          ) : null}

          {state.phase === "interpreting_transition" || state.phase === "processing" ? (
            <OriginProcessingStep announce={state.interpretationReady} />
          ) : null}

          {state.phase === "recoverable_error" ? (
            <OriginInterpretationError
              message={state.error ?? "Something went wrong."}
              onRetry={() => {
                interpretationStartedRef.current = false;
                dispatch({ type: "finish_introduction" });
              }}
              onWriteManually={() => dispatch({ type: "write_manually" })}
              busy={state.busy}
            />
          ) : null}

          {state.phase === "review" ? (
            <OriginReviewStep
              interpretation={state.interpretation}
              pending={state.pendingInterpretation}
              canUndo={state.undoStack.length > 0}
              onChange={setInterpretation}
              onUndo={() => dispatch({ type: "undo" })}
              onRegenerate={regenerate}
              onAcceptPending={() => dispatch({ type: "accept_regeneration" })}
              onDiscardPending={() => dispatch({ type: "discard_regeneration" })}
              onOpenChapter={() => dispatch({ type: "open_chapter" })}
              mediaReady={media.gateOpen(gateFor("chapter_opening"))}
              mediaProgress={media.gateProgress(gateFor("chapter_opening"))}
              busy={state.busy}
              error={state.error}
            />
          ) : null}
        </OriginOverlay>
      )}
    </OriginMediaStage>
  );
}
