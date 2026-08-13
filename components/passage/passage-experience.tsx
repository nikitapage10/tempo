"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OriginMediaStage } from "@/components/origin/origin-media-stage";
import { OriginOverlay, StepFade, TimedCopy } from "@/components/origin/origin-copy-layer";
import { OriginLookStep } from "@/components/origin/origin-look-step";
import { PassageAwakenStep } from "@/components/passage/passage-awaken-step";
import { PassageNameStep } from "@/components/passage/passage-name-step";
import { PassageDescribeStep } from "@/components/passage/passage-describe-step";
import { PassageTextStep } from "@/components/passage/passage-text-step";
import { PassageProcessingStep } from "@/components/passage/passage-processing-step";
import { PassageStoryScroll } from "@/components/passage/passage-story-scroll";
import { MorphingText } from "@/components/ui/morphing-text";
import { PASSAGE_PHASE_GATES, usePassageMedia } from "@/hooks/use-passage-media";
import { usePassageState } from "@/hooks/use-passage-state";
import { SOUNDTRACK_SRC, useOriginSoundtrack } from "@/hooks/use-origin-soundtrack";
import { clipForPassagePhase } from "@/lib/passage/reducer";
import { originAsset, type OriginMediaKey } from "@/lib/origin/media";

/**
 * PASSAGE, assembled. The counterpart to ORIGIN
 * (components/origin/origin-experience.tsx) for everyone joining as a Pro
 * rather than as the artist. Same film, same stage, same scroll mechanics.
 */

const HOME_ROUTE = "/";

const OPENING_LINES = [
  { text: "So, before you go in…", at: 0.04, until: 0.4 },
  { text: "tell us who you are.", at: 0.42, until: 0.72 },
];

export function PassageExperience() {
  const router = useRouter();
  const {
    state,
    dispatch,
    hydrated,
    runInterpretation,
    setInterpretation,
    complete,
    skip,
  } = usePassageState();
  const media = usePassageMedia(state.phase);
  const soundtrack = useOriginSoundtrack();

  const [soundOn, setSoundOn] = React.useState(false);
  const activeVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const activeKeyRef = React.useRef<OriginMediaKey | null>(null);
  const [, setActiveTick] = React.useState(0);
  const handleActiveElement = React.useCallback(
    (el: HTMLVideoElement | null, key: OriginMediaKey | null) => {
      activeVideoRef.current = el;
      activeKeyRef.current = key;
      setActiveTick((t) => t + 1);
    },
    []
  );

  const clip = clipForPassagePhase(state.phase);
  const poster = clip
    ? originAsset(clip.key).poster
    : state.phase === "awaiting_start"
      ? originAsset("opening01To02").poster
      : undefined;

  /** Kick the writing off once, the moment the processing beat is entered. */
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (state.phase !== "processing") {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    runInterpretation();
  }, [state.phase, runInterpretation]);

  const handleEnded = React.useCallback(() => {
    switch (state.phase) {
      case "opening":
        dispatch({ type: "opening_ended" });
        break;
      case "recognizing":
        dispatch({ type: "recognition_ended" });
        break;
      case "describe_transition":
      case "entry_transition":
        dispatch({ type: "transition_ended" });
        break;
      case "chapter_opening":
        dispatch({ type: "chapter_ended" });
        break;
      default:
        break;
    }
  }, [state.phase, dispatch]);

  const handleMediaError = React.useCallback(
    (key: OriginMediaKey) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[passage] falling back past ${key}`);
      }
      handleEnded();
    },
    [handleEnded]
  );

  async function handleEnter() {
    const ok = await complete();
    if (!ok) return;
    soundtrack.fade();
    router.replace(HOME_ROUTE);
  }

  /** Available from every question. Nobody is held here by a form. */
  async function handleSkip() {
    soundtrack.fade();
    await skip();
    router.replace(HOME_ROUTE);
  }

  if (!hydrated) {
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

  const mediaReady = (phase: Parameters<typeof clipForPassagePhase>[0]) =>
    media.gateOpen(PASSAGE_PHASE_GATES[phase] ?? []);

  const storyPhase =
    state.phase === "story_scroll" || state.phase === "saving" || state.phase === "complete";

  return (
    <OriginMediaStage
      clip={clip}
      posterSrc={poster}
      staticMode={state.staticMode}
      soundOn={soundOn}
      onEnded={handleEnded}
      onError={handleMediaError}
      onActiveElement={handleActiveElement}
    >
      <audio ref={soundtrack.ref} src={SOUNDTRACK_SRC} preload="auto" loop aria-hidden="true" />
      {storyPhase ? (
        <div className="absolute inset-0">
          <PassageStoryScroll
            displayName={state.displayName}
            roles={
              state.roleTitleOther.trim()
                ? [...state.roleTitles, state.roleTitleOther.trim()]
                : state.roleTitles
            }
            interpretation={state.interpretation}
            onInterpretationChange={setInterpretation}
            fallbackAnswers={{
              entry: state.entryText,
              supports: state.supportsText,
              work: state.functionText,
            }}
            staticMode={state.staticMode}
            videoRef={activeVideoRef}
            onEnter={handleEnter}
            onBackToLook={() => dispatch({ type: "back_to_function" })}
            busy={state.busy}
            error={state.error}
          />
        </div>
      ) : (
        <OriginOverlay>
          {state.phase === "awaiting_start" ? (
            <PassageAwakenStep
              staticMode={state.staticMode}
              onTuneIn={() => {
                // Order matters: sound is enabled in the same tick as the
                // gesture, so the first play() call is already allowed audio.
                setSoundOn(true);
                soundtrack.start();
              }}
              onBegin={() => dispatch({ type: "begin" })}
            />
          ) : null}

          {state.phase === "opening" ? (
            <TimedCopy
              lines={OPENING_LINES}
              videoRef={activeVideoRef}
              showAll={state.staticMode}
              resetKey={state.phase}
              matches={activeKeyRef.current === clip?.key}
            />
          ) : null}

          {state.phase === "name_idle" ? (
            <StepFade show className="w-full max-w-md">
              <PassageNameStep
                name={state.displayName}
                onNameChange={(name) => dispatch({ type: "set_name", name })}
                onBack={() => {
                  soundtrack.reset();
                  setSoundOn(false);
                  dispatch({ type: "back_to_awaken" });
                }}
                onSubmit={() => dispatch({ type: "submit_name" })}
                onSkipAll={handleSkip}
                mediaReady={mediaReady("recognizing")}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "recognizing" && activeKeyRef.current === clip?.key ? (
            <StepFade show enterMs={700} exitMs={600} className="w-full max-w-xl">
              <MorphingText
                as="h1"
                texts={[`${state.displayName}.`, "Good to meet you."]}
                loop={false}
                delaySeconds={0.15}
                holdSeconds={1.05}
                morphSeconds={0.75}
                className="font-display text-right text-2xl leading-snug text-text-hi sm:text-3xl [&>span]:text-right"
              />
            </StepFade>
          ) : null}

          {state.phase === "describe_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageDescribeStep
                selected={state.roleTitles}
                other={state.roleTitleOther}
                onToggle={(role) => dispatch({ type: "toggle_role", role })}
                onOtherChange={(text) => dispatch({ type: "set_role_other", text })}
                onBack={() => dispatch({ type: "back_to_name" })}
                onSubmit={() => dispatch({ type: "finish_describe" })}
                onSkipAll={handleSkip}
                mediaReady={mediaReady("describe_transition")}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "entry_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / where it started"
                heading="What got you into the music industry?"
                prompt="The moment, the person, or the gig that pulled you in, however it happened."
                placeholder="Start with what pulled you in…"
                value={state.entryText}
                onValueChange={(text) => dispatch({ type: "set_entry", text })}
                onBack={() => dispatch({ type: "back_to_describe" })}
                onFinish={() => dispatch({ type: "finish_entry" })}
                onSkipAll={handleSkip}
                mediaReady={mediaReady("entry_transition")}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "support_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / who you support"
                heading="Who or what do you support?"
                prompt="An artist, a roster, a label, a collective. Name it however you'd introduce it."
                placeholder="The artist, roster, or team you work with…"
                value={state.supportsText}
                onValueChange={(text) => dispatch({ type: "set_support", text })}
                onBack={() => dispatch({ type: "back_to_entry" })}
                onFinish={() => dispatch({ type: "finish_support" })}
                onSkipAll={handleSkip}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "function_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / what you do"
                heading="What do you actually do, day to day?"
                prompt="Skip the title. What does a normal week actually look like?"
                placeholder="Booking, scheduling, edits, campaigns, the road, the inbox…"
                value={state.functionText}
                onValueChange={(text) => dispatch({ type: "set_function", text })}
                onBack={() => dispatch({ type: "back_to_support" })}
                onFinish={() => dispatch({ type: "finish_function" })}
                onSkipAll={handleSkip}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "look_idle" ? (
            <StepFade show className="w-full max-w-2xl">
              <OriginLookStep
                kicker="Passage / your space"
                heading="Make the space yours"
                blurb="Colors, mark, and banner for your own workspace. All optional, and all changeable later in Settings."
                onBack={() => dispatch({ type: "back_to_function" })}
                onFinish={() => dispatch({ type: "finish_look" })}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "processing" ? (
            <StepFade show className="w-full max-w-md">
              <PassageProcessingStep />
            </StepFade>
          ) : null}
        </OriginOverlay>
      )}
    </OriginMediaStage>
  );
}
