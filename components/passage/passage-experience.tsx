"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { OriginMediaStage } from "@/components/origin/origin-media-stage";
import { OriginOverlay, StepFade, TimedCopy } from "@/components/origin/origin-copy-layer";
import { PassageAwakenStep } from "@/components/passage/passage-awaken-step";
import { PassageRoleStep } from "@/components/passage/passage-role-step";
import { PassageTextStep } from "@/components/passage/passage-text-step";
import { PassageStoryScroll } from "@/components/passage/passage-story-scroll";
import { usePassageState } from "@/hooks/use-passage-state";
import { clipForPassagePhase } from "@/lib/passage/reducer";
import { originAsset, type OriginMediaKey } from "@/lib/origin/media";

/**
 * PASSAGE, assembled — the invited-team-member counterpart to ORIGIN
 * (components/origin/origin-experience.tsx). Same film, same stage, same
 * scroll mechanics; a simpler orchestration, because there is no AI
 * interpretation step to gate on and no artist record to write back to.
 */

const HOME_ROUTE = "/";

const OPENING_LINES = [
  { text: "You're not building this alone.", at: 0.04, until: 0.4 },
  { text: "Let's get you set up.", at: 0.42, until: 0.72 },
];

export function PassageExperience() {
  const router = useRouter();
  const { state, dispatch, hydrated, complete } = usePassageState();

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

  const handleEnded = React.useCallback(() => {
    switch (state.phase) {
      case "opening":
        dispatch({ type: "opening_ended" });
        break;
      case "recognizing":
        dispatch({ type: "recognition_ended" });
        break;
      case "entry_transition":
        dispatch({ type: "transition_ended" });
        break;
      case "support_transition":
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
    router.replace(HOME_ROUTE);
  }

  if (!hydrated) {
    return <div className="fixed inset-0 bg-[var(--bg-0)]" />;
  }

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
      {storyPhase ? (
        <div className="absolute inset-0">
          <PassageStoryScroll
            roleTitle={state.roleTitle}
            roleTitleOther={state.roleTitleOther}
            entryText={state.entryText}
            supportsText={state.supportsText}
            functionText={state.functionText}
            staticMode={state.staticMode}
            videoRef={activeVideoRef}
            onEnter={handleEnter}
            onBackToSupport={() => dispatch({ type: "back_to_support" })}
            busy={state.busy}
            error={state.error}
          />
        </div>
      ) : (
        <OriginOverlay>
          {state.phase === "awaiting_start" ? (
            <PassageAwakenStep
              staticMode={state.staticMode}
              onTuneIn={() => setSoundOn(true)}
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

          {state.phase === "role_idle" ? (
            <StepFade show className="w-full max-w-md">
              <PassageRoleStep
                roleTitle={state.roleTitle}
                roleTitleOther={state.roleTitleOther}
                onRoleChange={(role) => dispatch({ type: "set_role", role })}
                onRoleOtherChange={(text) => dispatch({ type: "set_role_other", text })}
                onBack={() => dispatch({ type: "back_to_awaken" })}
                onSubmit={() => dispatch({ type: "submit_role" })}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "entry_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / where it started"
                heading="What got you into the music industry?"
                prompt="The moment, the person, or the gig that pulled you in — however it happened."
                placeholder="Start with what pulled you in…"
                value={state.entryText}
                onValueChange={(text) => dispatch({ type: "set_entry", text })}
                onBack={() => dispatch({ type: "back_to_role" })}
                onFinish={() => dispatch({ type: "finish_entry" })}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "support_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / who you support"
                heading="Who — or what — do you support?"
                prompt="An artist, a roster, a label, a collective. Name it however you'd introduce it."
                placeholder="The artist, roster, or team you work with…"
                value={state.supportsText}
                onValueChange={(text) => dispatch({ type: "set_support", text })}
                onBack={() => dispatch({ type: "back_to_entry" })}
                onFinish={() => dispatch({ type: "finish_support" })}
                busy={state.busy}
              />
            </StepFade>
          ) : null}

          {state.phase === "function_idle" ? (
            <StepFade show className="w-full max-w-xl">
              <PassageTextStep
                kicker="Passage / what you do"
                heading="What do you actually do, day to day?"
                prompt="Skip the title — what does a normal week actually look like?"
                placeholder="Booking, scheduling, catalog, the road, the inbox…"
                value={state.functionText}
                onValueChange={(text) => dispatch({ type: "set_function", text })}
                onBack={() => dispatch({ type: "back_to_support" })}
                onFinish={() => dispatch({ type: "finish_function" })}
                continueLabel="Continue →"
                busy={state.busy}
              />
            </StepFade>
          ) : null}
        </OriginOverlay>
      )}
    </OriginMediaStage>
  );
}
