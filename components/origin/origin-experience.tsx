"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OriginMediaStage } from "@/components/origin/origin-media-stage";
import {
  OriginOverlay,
  StepFade,
  TimedCopy,
  useClipProgress,
} from "@/components/origin/origin-copy-layer";
import { OriginAwakenStep } from "@/components/origin/origin-awaken-step";
import { OriginNameStep } from "@/components/origin/origin-name-step";
import { OriginIntroductionStep } from "@/components/origin/origin-introduction-step";
import {
  OriginInterpretationError,
  OriginProcessingStep,
} from "@/components/origin/origin-processing-step";
import { OriginReviewStep } from "@/components/origin/origin-review-step";
import { OriginStoryScroll } from "@/components/origin/origin-story-scroll";
import { MorphingText } from "@/components/ui/morphing-text";
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
const HOME_ROUTE = "/";

/**
 * "Who are you?" is deliberately not a timed line — it is the name panel's own
 * heading, which fades in over the tail of the opening so the question and the
 * field arrive together rather than one after the other.
 */
const OPENING_LINES = [
  { text: "Every story begins with a pulse.", at: 0.04, until: 0.4 },
  { text: "There's someone in the noise.", at: 0.42, until: 0.66 },
];

/**
 * How far through a transition its destination panel starts fading up. Early
 * enough that the panel is settled before the loop begins, late enough that it
 * never competes with the film's own moment.
 */
const PRELUDE_AT = 0.58;
/** Processing speaks later, after the artist's words have had a beat to land. */
const PROCESSING_PRELUDE_AT = 0.76;
/** The opening sentence must finish its fade before the name panel begins. */
const NAME_PRELUDE_AT = 0.82;

/**
 * How long before a transition's end the next phase is entered.
 *
 * The stage crossfades on phase change, so advancing early means the outgoing
 * clip is still *moving* underneath the incoming one for the whole blend.
 * Waiting for `ended` would blend out of a frozen final frame, which is what
 * made every handoff read as a stop rather than a dissolve.
 */
const CROSSFADE_LEAD_MS = 700;

export function OriginExperience({
  importPending,
  revisit = false,
  replay = false,
}: {
  importPending: boolean;
  revisit?: boolean;
  replay?: boolean;
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
    setInterpretation,
  } = useOriginState(revisit, replay);

  const media = useOriginMedia(state.phase);
  /** Set by the opening tap — the gesture browsers require for audible video. */
  const [soundOn, setSoundOn] = React.useState(false);
  /**
   * Chosen in the import chapter. Defaults to importing when Import is still
   * owed, so an artist who scrolls straight past still lands somewhere useful.
   */
  const [importChoice, setImportChoice] = React.useState<"imported" | "empty" | null>(
    null
  );

  /**
   * The element currently on screen, so copy timing and scrubbing can read it.
   *
   * The key it belongs to is tracked alongside it, and everything that listens
   * to this element checks that first. Without it, the moment a phase changed
   * both the copy timer and the early-advance listener bound to the *previous*
   * clip — which is usually a loop. A loop is always within 700ms of its end,
   * so the incoming transition was advanced past instantly and its destination
   * panel appeared at once.
   */
  const activeVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const activeKeyRef = React.useRef<OriginMediaKey | null>(null);
  const [activeTick, setActiveTick] = React.useState(0);
  const handleActiveElement = React.useCallback(
    (el: HTMLVideoElement | null, key: OriginMediaKey | null) => {
      activeVideoRef.current = el;
      activeKeyRef.current = key;
      // Wakes the effects below so they can bind to the element that just
      // became visible, rather than whatever was there before.
      setActiveTick((t) => t + 1);
    },
    []
  );

  const clip = clipForPhase(state.phase);
  // The waking copy and the first film share one exact still, so tapping into
  // motion changes time rather than changing the page's colour grade.
  const poster = clip
    ? originAsset(clip.key).poster
    : state.phase === "awaiting_start"
      ? originAsset("opening01To02").poster
      : undefined;

  const clipProgress = useClipProgress(
    activeVideoRef,
    state.phase,
    Boolean(clip) && activeKeyRef.current === clip?.key,
    activeTick
  );
  /** True once the current transition is far enough along to show what's next. */
  const prelude = media.staticMode || clipProgress >= PRELUDE_AT;
  const namePrelude = media.staticMode || clipProgress >= NAME_PRELUDE_AT;

  /*
   * Two flags per step, and the distinction matters.
   *
   * `mount` puts the panel in the DOM at opacity 0 as soon as its incoming
   * transition starts; `show` fades it up later. Collapsing these into one
   * condition is what made the name box appear to pop — an element that mounts
   * with the final opacity already applied has nothing to transition from, so
   * the CSS never animates.
   */
  const mountName =
    state.phase === "opening" ||
    state.phase === "name_idle" ||
    state.phase === "recognizing";
  const showName =
    state.phase === "name_idle" || (state.phase === "opening" && namePrelude);

  const mountIntroduction =
    state.phase === "recognizing" ||
    state.phase === "introduction_idle" ||
    state.phase === "recording" ||
    state.phase === "interpreting_transition";
  const showIntroduction =
    state.phase === "introduction_idle" ||
    state.phase === "recording";

  const recognitionVisible =
    state.phase === "recognizing" &&
    activeKeyRef.current === clip?.key &&
    clipProgress >= 0.18 &&
    clipProgress < 0.62;

  const mountProcessing =
    state.phase === "interpreting_transition" ||
    state.phase === "processing" ||
    state.phase === "resolving";
  const showProcessing =
    state.phase === "processing" ||
    (state.phase === "interpreting_transition" &&
      (media.staticMode || clipProgress >= PROCESSING_PRELUDE_AT));

  const mountReview =
    state.phase === "resolving" ||
    state.phase === "review" ||
    state.phase === "chapter_opening";
  const showReview = state.phase === "review" || (state.phase === "resolving" && prelude);

  /**
   * A fast interpretation must still leave room for frame 4 to breathe. Count
   * a real media cycle rather than a wall-clock timeout: playback pauses in a
   * hidden tab, so only a wrap of the visible loop satisfies the dwell.
   */
  React.useEffect(() => {
    if (state.phase !== "processing" || state.processingDwellSettled) return;
    if (media.staticMode) {
      dispatch({ type: "processing_dwell_ended" });
      return;
    }
    const video = activeVideoRef.current;
    if (!video || activeKeyRef.current !== "loop04") return;

    let previous = video.currentTime;
    const onTime = () => {
      const current = video.currentTime;
      const duration = video.duration;
      if (
        Number.isFinite(duration) &&
        duration > 0 &&
        previous > duration * 0.72 &&
        current < duration * 0.28
      ) {
        dispatch({ type: "processing_dwell_ended" });
      }
      previous = current;
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [state.phase, state.processingDwellSettled, media.staticMode, activeTick, dispatch]);

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

  // Kept in a ref so the early-advance listener below never has to re-bind just
  // because the callback identity changed.
  const handleEndedRef = React.useRef(handleEnded);
  handleEndedRef.current = handleEnded;

  /**
   * Advance a transition shortly before it ends, so the destination fades up
   * over live motion. `onEnded` below stays as the backstop for anything that
   * never reaches this point.
   */
  const advancedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    advancedRef.current = null;
  }, [state.phase]);

  React.useEffect(() => {
    if (media.staticMode) return;
    if (!clip || clip.loop) return;
    // The chapter opening is the exception: it plays to its very last frame and
    // freezes there, and the scroll video fades in over that held frame. Cutting
    // it short would blend out of mid-motion into a static first frame, which is
    // the one place that reads badly.
    if (state.phase === "chapter_opening") return;
    const video = activeVideoRef.current;
    // Only ever listen to the element showing *this* clip.
    if (!video || activeKeyRef.current !== clip.key) return;

    const onTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const remainingMs = (video.duration - video.currentTime) * 1000;
      if (remainingMs > CROSSFADE_LEAD_MS) return;
      if (advancedRef.current === state.phase) return;
      advancedRef.current = state.phase;
      handleEndedRef.current();
    };

    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
    // activeTick re-runs this once the stage has swapped in the new element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, clip?.key, clip?.loop, media.staticMode, activeTick]);

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

    if (artistId) {
      // Always applied now, rather than offered as a checkbox: it only fills
      // blank fields and never changes visibility, so there was nothing for the
      // artist to weigh up. Never blocks entry — see profile-mapping.
      await applyOriginToProfile(artistId, state.interpretation, state.name).catch(
        () => {}
      );
    }

    await queryClient.invalidateQueries({ queryKey: ["artists"] });
    await queryClient.invalidateQueries({ queryKey: ["artist-profile", artistId] });

    markFirstOpenPending();
    // The import chapter decides where Enter TEMPO lands; falling back to
    // whether Import is still owed when they scrolled past without choosing.
    // Import now happens inside the story, so having imported (or chosen to
    // start empty) means there is nothing left to send them to.
    // Import now runs inside the story, so Enter TEMPO always opens the app.
    router.replace(HOME_ROUTE);
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
      soundOn={soundOn}
      onEnded={handleEnded}
      onError={handleMediaError}
      onActiveElement={handleActiveElement}
    >
      {/* The story owns the whole scroll range, so it sits outside the centred
          overlay the other steps share. */}
      {storyPhase ? (
        <div className="absolute inset-0">
          <OriginStoryScroll
            interpretation={state.interpretation}
            staticMode={media.staticMode}
            videoRef={activeVideoRef}
            onEnter={handleEnter}
            onBack={() => dispatch({ type: "back_to_review" })}
            busy={state.busy}
            error={state.error}
            onSkipImport={() => setImportChoice("empty")}
            onImportComplete={() => setImportChoice("imported")}
            importChoice={importChoice}
            importPending={importPending}
          />
        </div>
      ) : (
        <OriginOverlay>
          {state.phase === "awaiting_start" ? (
            <OriginAwakenStep
              staticMode={media.staticMode}
              onBegin={() => {
                // Order matters: sound is enabled in the same tick as the
                // gesture, so the first play() call is already allowed audio.
                setSoundOn(true);
                dispatch({ type: "begin" });
              }}
            />
          ) : null}

          {state.phase === "opening" ? (
            <TimedCopy
              lines={OPENING_LINES}
              videoRef={activeVideoRef}
              showAll={media.staticMode}
              resetKey={state.phase}
              matches={activeKeyRef.current === clip?.key}
              tick={activeTick}
            />
          ) : null}

          {mountName ? (
            <StepFade show={showName} className="w-full max-w-md">
              <OriginNameStep
                name={state.name}
                onNameChange={(name) => dispatch({ type: "set_name", name })}
                onSubmit={() => dispatch({ type: "submit_name" })}
                mediaReady={media.gateOpen(gateFor("recognizing"))}
                busy={state.busy}
                // Focus waits for the loop; grabbing it mid-film would open a
                // mobile keyboard over the opening.
                active={state.phase === "name_idle"}
              />
            </StepFade>
          ) : null}

          {state.phase === "recognizing" && activeKeyRef.current === clip?.key ? (
            <StepFade
              show={recognitionVisible}
              enterMs={700}
              exitMs={600}
              className="w-full max-w-xl"
            >
              <MorphingText
                as="h1"
                texts={[`${state.name}.`, "Good. I can see you now."]}
                loop={false}
                delaySeconds={0.3}
                holdSeconds={0.95}
                morphSeconds={0.9}
                className="font-display text-right text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-right"
              />
            </StepFade>
          ) : null}

          {mountIntroduction ? (
            <StepFade show={showIntroduction} className="w-full max-w-xl">
              <OriginIntroductionStep
                introduction={state.introduction}
                onIntroductionChange={(text) => dispatch({ type: "set_introduction", text })}
                onFinish={() => dispatch({ type: "finish_introduction" })}
                onRecordingChange={(recording) =>
                  dispatch({ type: recording ? "start_recording" : "stop_recording" })
                }
                voiceActive={showIntroduction}
                mediaReady={media.gateOpen(gateFor("interpreting_transition"))}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {mountProcessing ? (
            <StepFade show={showProcessing} className="w-full max-w-md">
              <OriginProcessingStep
                announce={state.interpretationReady}
                voiceActive={showProcessing}
              />
            </StepFade>
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

          {mountReview ? (
            <StepFade show={showReview} className="w-full max-w-2xl">
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
            </StepFade>
          ) : null}
        </OriginOverlay>
      )}
    </OriginMediaStage>
  );
}
