import type { OriginMediaKey } from "@/lib/origin/media";
import type {
  MemberPassage,
  PassageInterpretation,
  PassageStep,
} from "@/lib/passage/types";
import { EMPTY_PASSAGE_INTERPRETATION } from "@/lib/passage/types";

/**
 * The PASSAGE experience state machine.
 *
 * Same rhythm as ORIGIN's reducer (lib/origin/reducer.ts), across the same ten
 * film assets, with no AI interpretation step: nothing here is generated, so
 * there is nothing to wait on beyond the film itself.
 *
 * Six questions across four loops. Support, function and look share loop05 the
 * way Origin's look and processing do, so the later beats do not need a
 * transition apiece the film does not have.
 */

export type PassagePhase =
  | "booting"
  | "awaiting_start"
  | "opening"
  | "name_idle"
  | "recognizing"
  | "describe_idle"
  | "describe_transition"
  | "entry_idle"
  | "entry_transition"
  | "support_idle"
  | "function_idle"
  | "look_idle"
  | "processing"
  | "chapter_opening"
  | "story_scroll"
  | "saving"
  | "complete";

export type PassageState = {
  phase: PassagePhase;
  staticMode: boolean;

  displayName: string;
  /** A person is routinely more than one of these, so this is a set. */
  roleTitles: string[];
  roleTitleOther: string;
  entryText: string;
  supportsText: string;
  functionText: string;

  /** The written story, once TEMPO has read the answers. */
  interpretation: PassageInterpretation;
  /** Set when the interpretation request has returned, either way. */
  interpretationReady: boolean;

  transitionSettled: boolean;
  error: string | null;
  busy: boolean;
  savedStep: PassageStep;
};

export type PassageAction =
  | { type: "boot"; staticMode: boolean; resume: MemberPassage | null }
  | { type: "begin" }
  | { type: "opening_ended" }
  | { type: "set_name"; name: string }
  | { type: "submit_name" }
  | { type: "recognition_ended" }
  | { type: "toggle_role"; role: string }
  | { type: "set_role_other"; text: string }
  | { type: "finish_describe" }
  | { type: "set_entry"; text: string }
  | { type: "finish_entry" }
  | { type: "set_support"; text: string }
  | { type: "finish_support" }
  | { type: "set_function"; text: string }
  | { type: "finish_function" }
  | { type: "finish_look" }
  | { type: "interpretation_ok"; interpretation: PassageInterpretation }
  | { type: "interpretation_failed" }
  | { type: "edit_interpretation"; interpretation: PassageInterpretation }
  | { type: "back_to_awaken" }
  | { type: "back_to_name" }
  | { type: "back_to_describe" }
  | { type: "back_to_entry" }
  | { type: "back_to_support" }
  | { type: "back_to_function" }
  | { type: "transition_ended" }
  | { type: "chapter_ended" }
  | { type: "begin_save" }
  | { type: "save_ok" }
  | { type: "save_failed"; message: string }
  | { type: "dismiss_error" }
  | { type: "set_busy"; busy: boolean };

export const INITIAL_PASSAGE_STATE: PassageState = {
  phase: "booting",
  staticMode: false,
  displayName: "",
  roleTitles: [],
  roleTitleOther: "",
  entryText: "",
  supportsText: "",
  functionText: "",
  interpretation: EMPTY_PASSAGE_INTERPRETATION,
  interpretationReady: false,
  transitionSettled: false,
  error: null,
  busy: false,
  savedStep: "name",
};

/** Where a saved step resumes. Never a transition. */
const RESUME_PHASE: Record<PassageStep, PassagePhase> = {
  name: "name_idle",
  describe: "describe_idle",
  entry: "entry_idle",
  support: "support_idle",
  function: "function_idle",
  look: "look_idle",
  processing: "processing",
  story: "story_scroll",
  complete: "complete",
};

export const PASSAGE_PHASE_LOOP: Partial<Record<PassagePhase, OriginMediaKey>> = {
  name_idle: "loop02",
  describe_idle: "loop03",
  entry_idle: "loop04",
  support_idle: "loop05",
  function_idle: "loop05",
  look_idle: "loop05",
  processing: "loop05",
  story_scroll: "scroll06",
  saving: "scroll06",
  complete: "scroll06",
};

export const PASSAGE_PHASE_TRANSITION: Partial<Record<PassagePhase, OriginMediaKey>> = {
  opening: "opening01To02",
  recognizing: "transition02To03",
  describe_transition: "transition03To04",
  entry_transition: "transition04To05",
  chapter_opening: "transition05To06",
};

export function passageReducer(state: PassageState, action: PassageAction): PassageState {
  switch (action.type) {
    case "boot": {
      const { resume, staticMode } = action;
      if (!resume) {
        return {
          ...state,
          staticMode,
          phase: staticMode ? "name_idle" : "awaiting_start",
        };
      }
      return {
        ...state,
        staticMode,
        displayName: resume.displayName ?? "",
        roleTitles: resume.roleTitles ?? [],
        roleTitleOther: resume.roleTitleOther ?? "",
        entryText: resume.entryText ?? "",
        supportsText: resume.supportsText ?? "",
        functionText: resume.functionText ?? "",
        interpretation: resume.interpretation ?? EMPTY_PASSAGE_INTERPRETATION,
        interpretationReady: resume.interpretation !== null,
        transitionSettled: true,
        savedStep: resume.currentStep,
        phase: RESUME_PHASE[resume.currentStep],
      };
    }

    case "begin":
      return state.phase === "awaiting_start"
        ? { ...state, phase: state.staticMode ? "name_idle" : "opening" }
        : state;

    case "opening_ended":
      return state.phase === "opening" ? { ...state, phase: "name_idle" } : state;

    case "set_name":
      return { ...state, displayName: action.name, error: null };

    case "submit_name":
      if (state.phase !== "name_idle" || state.busy) return state;
      return {
        ...state,
        phase: state.staticMode ? "describe_idle" : "recognizing",
        savedStep: "describe",
        error: null,
      };

    case "recognition_ended":
      return state.phase === "recognizing" ? { ...state, phase: "describe_idle" } : state;

    case "toggle_role": {
      const has = state.roleTitles.includes(action.role);
      return {
        ...state,
        roleTitles: has
          ? state.roleTitles.filter((role) => role !== action.role)
          : [...state.roleTitles, action.role],
        error: null,
      };
    }

    case "set_role_other":
      return { ...state, roleTitleOther: action.text, error: null };

    case "finish_describe":
      if (state.busy || state.phase !== "describe_idle") return state;
      return {
        ...state,
        phase: state.staticMode ? "entry_idle" : "describe_transition",
        savedStep: "entry",
        error: null,
      };

    case "set_entry":
      return { ...state, entryText: action.text, error: null };

    case "finish_entry":
      if (state.busy || state.phase !== "entry_idle") return state;
      return {
        ...state,
        phase: state.staticMode ? "support_idle" : "entry_transition",
        savedStep: "support",
        error: null,
      };

    case "set_support":
      return { ...state, supportsText: action.text, error: null };

    case "finish_support":
      if (state.busy || state.phase !== "support_idle") return state;
      // Shares loop05 with support, so no transition plays between them.
      return { ...state, phase: "function_idle", savedStep: "function", error: null };

    case "set_function":
      return { ...state, functionText: action.text, error: null };

    case "finish_function":
      if (state.busy || state.phase !== "function_idle") return state;
      return { ...state, phase: "look_idle", savedStep: "look", error: null };

    case "finish_look":
      if (state.busy || state.phase !== "look_idle") return state;
      // Holds on loop05 while TEMPO reads the answers. The film is already at
      // this beat, so there is no transition to wait on, only the request.
      return {
        ...state,
        phase: "processing",
        savedStep: "processing",
        interpretationReady: false,
        error: null,
      };

    case "interpretation_ok":
      if (state.phase !== "processing") {
        // Arrived late (they went back a step). Keep it without moving them.
        return { ...state, interpretation: action.interpretation, interpretationReady: true };
      }
      return {
        ...state,
        interpretation: action.interpretation,
        interpretationReady: true,
        phase: state.staticMode ? "story_scroll" : "chapter_opening",
        savedStep: "story",
      };

    case "interpretation_failed":
      // A failed reading must never strand anyone. The story scroll falls back
      // to showing their own answers, which is still a complete ending.
      if (state.phase !== "processing") return { ...state, interpretationReady: true };
      return {
        ...state,
        interpretationReady: true,
        phase: state.staticMode ? "story_scroll" : "chapter_opening",
        savedStep: "story",
      };

    case "edit_interpretation":
      return { ...state, interpretation: action.interpretation };

    case "back_to_awaken":
      return state.phase === "name_idle"
        ? { ...state, phase: "awaiting_start", savedStep: "name", error: null }
        : state;

    case "back_to_name":
      return state.phase === "describe_idle"
        ? { ...state, phase: "name_idle", savedStep: "name", error: null }
        : state;

    case "back_to_describe":
      return state.phase === "entry_idle"
        ? { ...state, phase: "describe_idle", savedStep: "describe", error: null }
        : state;

    case "back_to_entry":
      return state.phase === "support_idle"
        ? { ...state, phase: "entry_idle", savedStep: "entry", error: null }
        : state;

    case "back_to_support":
      return state.phase === "function_idle"
        ? { ...state, phase: "support_idle", savedStep: "support", error: null, busy: false }
        : state;

    case "back_to_function":
      return state.phase === "look_idle" ||
        state.phase === "story_scroll" ||
        state.phase === "processing"
        ? { ...state, phase: "function_idle", savedStep: "function", error: null, busy: false }
        : state;

    case "transition_ended": {
      if (state.phase === "describe_transition") {
        return { ...state, phase: "entry_idle", transitionSettled: true };
      }
      if (state.phase === "entry_transition") {
        return { ...state, phase: "support_idle", transitionSettled: true };
      }
      return state;
    }

    case "chapter_ended":
      return state.phase === "chapter_opening" ? { ...state, phase: "story_scroll" } : state;

    case "begin_save":
      if (state.busy) return state;
      return { ...state, phase: "saving", busy: true, error: null };

    case "save_ok":
      return { ...state, phase: "complete", busy: false, savedStep: "complete" };

    case "save_failed":
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
export function clipForPassagePhase(
  phase: PassagePhase
): { key: OriginMediaKey; loop: boolean } | null {
  const transition = PASSAGE_PHASE_TRANSITION[phase];
  if (transition) return { key: transition, loop: false };
  const loop = PASSAGE_PHASE_LOOP[phase];
  if (loop) return { key: loop, loop: phase !== "story_scroll" };
  return null;
}
