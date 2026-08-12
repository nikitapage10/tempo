import type { OriginMediaKey } from "@/lib/origin/media";
import type {
  ArtistOrigin,
  ArtistOriginInterpretation,
  OriginStep,
} from "@/lib/origin/types";
import { EMPTY_INTERPRETATION } from "@/lib/origin/types";

/**
 * The ORIGIN experience state machine.
 *
 * Two clocks run independently here and must not be conflated: media timing
 * (a transition plays to its end) and API timing (interpretation returns when
 * it returns). A transition is never cut short because a request came back
 * early, and the flow never advances into an asset that is not ready.
 *
 * `interpretation` is the confirmed working copy. `pendingInterpretation` holds
 * a regeneration that the artist has not accepted yet, so "Try another
 * interpretation" can never destroy what they already have.
 */

export type OriginPhase =
  | "booting"
  // Holds on the first poster with the waking copy until the artist taps.
  // That tap is also the user gesture browsers require before video may play
  // with sound, so ORIGIN cannot start itself — see §13.
  | "awaiting_start"
  | "opening"
  | "name_idle"
  | "recognizing"
  | "introduction_idle"
  | "recording"
  | "direction_idle"
  | "looking_transition"
  | "look_idle"
  | "interpreting_transition"
  | "processing"
  | "resolving"
  | "chapter_opening"
  | "story_scroll"
  | "saving"
  | "complete"
  | "recoverable_error";

export type OriginState = {
  phase: OriginPhase;
  /** Static mode: reduced motion or a constrained connection. No video plays. */
  staticMode: boolean;

  name: string;
  introduction: string;
  direction: string;
  interpretation: ArtistOriginInterpretation;
  /** A regeneration awaiting accept/discard. Never overwrites `interpretation`. */
  pendingInterpretation: ArtistOriginInterpretation | null;
  /** One level of session undo over the working copy. */
  undoStack: ArtistOriginInterpretation[];

  /** Set when the transition covering interpretation has finished playing. */
  transitionSettled: boolean;
  /** Set when the interpretation request has returned. */
  interpretationReady: boolean;
  /** Set after frame 4 has completed one visible loop. */
  processingDwellSettled: boolean;

  error: string | null;
  /** Guards every irreversible or duplicate-prone action. */
  busy: boolean;
  savedStep: OriginStep;
};

export type OriginAction =
  | { type: "boot"; staticMode: boolean; resume: ArtistOrigin | null }
  | { type: "begin" }
  | { type: "opening_ended" }
  | { type: "set_name"; name: string }
  | { type: "submit_name" }
  | { type: "recognition_ended" }
  | { type: "set_introduction"; text: string }
  | { type: "set_direction"; text: string }
  | { type: "start_recording" }
  | { type: "stop_recording" }
  | { type: "finish_introduction" }
  | { type: "finish_direction" }
  | { type: "finish_look" }
  | { type: "back_to_awaken" }
  | { type: "back_to_name" }
  | { type: "back_to_introduction" }
  | { type: "back_to_direction" }
  | { type: "back_to_look" }
  | { type: "transition_ended" }
  | { type: "processing_dwell_ended" }
  | { type: "interpretation_ok"; interpretation: ArtistOriginInterpretation }
  | { type: "interpretation_failed"; message: string }
  | { type: "retry_interpretation" }
  | { type: "write_manually" }
  | { type: "resolve_ended" }
  | { type: "edit_interpretation"; interpretation: ArtistOriginInterpretation }
  | { type: "regeneration_ok"; interpretation: ArtistOriginInterpretation }
  | { type: "accept_regeneration" }
  | { type: "discard_regeneration" }
  | { type: "undo" }
  | { type: "chapter_ended" }
  | { type: "begin_save" }
  | { type: "save_ok" }
  | { type: "save_failed"; message: string }
  | { type: "dismiss_error" }
  | { type: "set_busy"; busy: boolean };

export const INITIAL_ORIGIN_STATE: OriginState = {
  phase: "booting",
  staticMode: false,
  name: "",
  introduction: "",
  direction: "",
  interpretation: EMPTY_INTERPRETATION,
  pendingInterpretation: null,
  undoStack: [],
  transitionSettled: false,
  interpretationReady: false,
  processingDwellSettled: false,
  error: null,
  busy: false,
  savedStep: "name",
};

/** Where a saved step resumes. Never a transition — see §7. */
const RESUME_PHASE: Record<OriginStep, OriginPhase> = {
  name: "name_idle",
  introduction: "introduction_idle",
  processing: "processing",
  review: "direction_idle",
  look: "look_idle",
  story: "story_scroll",
  complete: "complete",
};

/**
 * The loop or scrub asset that holds during each stable phase.
 * Look + processing share loop05 — the film beat after direction — so the
 * optional look panel sits on the “second video” without replaying 04→05 later.
 */
export const PHASE_LOOP: Partial<Record<OriginPhase, OriginMediaKey>> = {
  name_idle: "loop02",
  introduction_idle: "loop03",
  recording: "loop03",
  direction_idle: "loop04",
  look_idle: "loop05",
  processing: "loop05",
  story_scroll: "scroll06",
  saving: "scroll06",
  complete: "scroll06",
};

/** The transition that plays on entering each transitional phase. */
export const PHASE_TRANSITION: Partial<Record<OriginPhase, OriginMediaKey>> = {
  opening: "opening01To02",
  recognizing: "transition02To03",
  interpreting_transition: "transition03To04",
  looking_transition: "transition04To05",
  chapter_opening: "transition05To06",
};

const MAX_UNDO = 5;

function pushUndo(state: OriginState): ArtistOriginInterpretation[] {
  return [state.interpretation, ...state.undoStack].slice(0, MAX_UNDO);
}

/**
 * Both conditions must hold before leaving the processing loop: the covering
 * transition has finished AND the interpretation has arrived. This is the rule
 * that makes a fast model response harmless.
 *
 * After look, the 04→05 transition has already played, so we go straight into
 * the chapter opening (or the story in static mode) instead of resolving again.
 */
function maybeResolve(state: OriginState): OriginState {
  if (state.phase !== "processing") return state;
  if (
    !state.transitionSettled ||
    !state.interpretationReady ||
    !state.processingDwellSettled
  ) {
    return state;
  }
  return {
    ...state,
    phase: state.staticMode ? "story_scroll" : "chapter_opening",
    savedStep: "story",
  };
}

export function originReducer(state: OriginState, action: OriginAction): OriginState {
  switch (action.type) {
    case "boot": {
      const { resume, staticMode } = action;
      if (!resume) {
        return {
          ...state,
          staticMode,
          // Static mode has no opening film to play or gesture to collect.
          phase: staticMode ? "name_idle" : "awaiting_start",
        };
      }
      // A v2 draft may have reached processing before the direction question
      // existed. Send that draft to the new question instead of calling the
      // v3 interpreter with a missing answer.
      const savedStep =
        resume.currentStep === "processing" && !resume.directionText?.trim()
          ? "review"
          : resume.currentStep;
      return {
        ...state,
        staticMode,
        name: resume.artistNameDraft ?? "",
        introduction: resume.introductionText ?? "",
        direction: resume.directionText ?? "",
        interpretation: resume.interpretation ?? EMPTY_INTERPRETATION,
        interpretationReady: resume.interpretation !== null,
        // A resumed processing step still deserves the full frame hold. In
        // static mode there is no media cycle to wait for.
        processingDwellSettled: staticMode,
        // Resuming lands on a stable loop, so nothing is mid-transition.
        transitionSettled: true,
        savedStep,
        phase: RESUME_PHASE[savedStep],
      };
    }

    case "begin":
      return state.phase === "awaiting_start"
        ? { ...state, phase: state.staticMode ? "name_idle" : "opening" }
        : state;

    case "opening_ended":
      return state.phase === "opening" ? { ...state, phase: "name_idle" } : state;

    case "set_name":
      return { ...state, name: action.name, error: null };

    case "submit_name":
      if (state.phase !== "name_idle" || state.busy) return state;
      return {
        ...state,
        phase: state.staticMode ? "introduction_idle" : "recognizing",
        savedStep: "introduction",
        error: null,
      };

    case "recognition_ended":
      return state.phase === "recognizing"
        ? { ...state, phase: "introduction_idle" }
        : state;

    case "set_introduction":
      return { ...state, introduction: action.text, error: null };

    case "set_direction":
      return { ...state, direction: action.text, error: null };

    case "start_recording":
      return state.phase === "introduction_idle" ? { ...state, phase: "recording" } : state;

    case "stop_recording":
      return state.phase === "recording" ? { ...state, phase: "introduction_idle" } : state;

    case "finish_introduction":
      if (state.busy) return state;
      if (state.phase !== "introduction_idle" && state.phase !== "recording") return state;
      return {
        ...state,
        phase: state.staticMode ? "direction_idle" : "interpreting_transition",
        // `review` remains the persisted label for compatibility with the
        // original current_step constraint. It now means the direction input.
        savedStep: "review",
        error: null,
      };

    case "finish_direction":
      if (state.busy || state.phase !== "direction_idle") return state;
      return {
        ...state,
        phase: state.staticMode ? "look_idle" : "looking_transition",
        savedStep: "look",
        error: null,
      };

    case "finish_look":
      if (state.busy || state.phase !== "look_idle") return state;
      return {
        ...state,
        phase: "processing",
        savedStep: "processing",
        transitionSettled: true,
        interpretationReady: false,
        processingDwellSettled: state.staticMode,
        error: null,
      };

    case "back_to_awaken":
      return state.phase === "name_idle"
        ? { ...state, phase: "awaiting_start", savedStep: "name", error: null }
        : state;

    case "back_to_name":
      return state.phase === "introduction_idle"
        ? { ...state, phase: "name_idle", savedStep: "name", error: null }
        : state;

    case "back_to_introduction":
      return state.phase === "direction_idle"
        ? { ...state, phase: "introduction_idle", savedStep: "introduction", error: null }
        : state;

    case "back_to_direction":
      return state.phase === "look_idle"
        ? {
            ...state,
            phase: "direction_idle",
            savedStep: "review",
            error: null,
            busy: false,
          }
        : state;

    case "back_to_look":
      return state.phase === "story_scroll" || state.phase === "processing"
        ? {
            ...state,
            phase: "look_idle",
            savedStep: "look",
            error: null,
            busy: false,
          }
        : state;

    case "transition_ended": {
      if (state.phase === "interpreting_transition") {
        return { ...state, phase: "direction_idle", transitionSettled: true };
      }
      if (state.phase === "looking_transition") {
        return { ...state, phase: "look_idle", transitionSettled: true };
      }
      return state;
    }

    case "processing_dwell_ended":
      return maybeResolve({ ...state, processingDwellSettled: true });

    case "interpretation_ok": {
      // Arriving during the transition is normal and must not interrupt it.
      const next: OriginState = {
        ...state,
        interpretation: action.interpretation,
        interpretationReady: true,
        error: null,
      };
      return maybeResolve(next);
    }

    case "interpretation_failed":
      // The transcript and every draft value survive — §16.
      return { ...state, phase: "recoverable_error", error: action.message, busy: false };

    case "retry_interpretation":
      return state.phase === "recoverable_error"
        ? {
            ...state,
            phase: "processing",
            savedStep: "processing",
            interpretationReady: false,
            processingDwellSettled: state.staticMode,
            transitionSettled: true,
            error: null,
          }
        : state;

    case "write_manually":
      return {
        ...state,
        phase: state.staticMode ? "story_scroll" : "chapter_opening",
        savedStep: "story",
        error: null,
        interpretationReady: true,
        transitionSettled: true,
        processingDwellSettled: true,
      };

    case "resolve_ended":
      return state.phase === "resolving"
        ? {
            ...state,
            phase: state.staticMode ? "story_scroll" : "chapter_opening",
            savedStep: "story",
          }
        : state;

    case "edit_interpretation":
      return {
        ...state,
        undoStack: pushUndo(state),
        interpretation: action.interpretation,
      };

    case "regeneration_ok":
      // Held aside until accepted, so the visible version never flickers.
      return { ...state, pendingInterpretation: action.interpretation, busy: false };

    case "accept_regeneration":
      if (!state.pendingInterpretation) return state;
      return {
        ...state,
        undoStack: pushUndo(state),
        interpretation: state.pendingInterpretation,
        pendingInterpretation: null,
      };

    case "discard_regeneration":
      return { ...state, pendingInterpretation: null };

    case "undo": {
      const [previous, ...rest] = state.undoStack;
      if (!previous) return state;
      return { ...state, interpretation: previous, undoStack: rest };
    }

    case "chapter_ended":
      return state.phase === "chapter_opening"
        ? { ...state, phase: "story_scroll" }
        : state;

    case "begin_save":
      if (state.busy) return state;
      return { ...state, phase: "saving", busy: true, error: null };

    case "save_ok":
      return { ...state, phase: "complete", busy: false, savedStep: "complete" };

    case "save_failed":
      // Stays on the final step with every edit intact — §27.
      return { ...state, phase: "story_scroll", busy: false, error: action.message };

    case "dismiss_error":
      return { ...state, error: null };

    case "set_busy":
      return { ...state, busy: action.busy };

    default:
      return state;
  }
}

/** The asset that should be on screen for a phase, and whether it loops. */
export function clipForPhase(
  phase: OriginPhase
): { key: OriginMediaKey; loop: boolean } | null {
  const transition = PHASE_TRANSITION[phase];
  if (transition) return { key: transition, loop: false };
  const loop = PHASE_LOOP[phase];
  if (loop) return { key: loop, loop: phase !== "story_scroll" };
  return null;
}
