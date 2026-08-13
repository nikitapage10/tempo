import type { OriginMediaKey } from "@/lib/origin/media";
import type { MemberPassage, PassageStep } from "@/lib/passage/types";

/**
 * The PASSAGE experience state machine.
 *
 * Deliberately the same rhythm as ORIGIN's reducer (lib/origin/reducer.ts) —
 * four questions, each held on its own loop, connected by the same ten film
 * assets — but with no AI interpretation step: nothing here is generated, so
 * there is nothing to wait on beyond the film itself.
 */

export type PassagePhase =
  | "booting"
  | "awaiting_start"
  | "opening"
  | "role_idle"
  | "recognizing"
  | "entry_idle"
  | "entry_transition"
  | "support_idle"
  | "support_transition"
  | "function_idle"
  | "look_idle"
  | "chapter_opening"
  | "story_scroll"
  | "saving"
  | "complete";

export type PassageState = {
  phase: PassagePhase;
  staticMode: boolean;

  roleTitle: string;
  roleTitleOther: string;
  entryText: string;
  supportsText: string;
  functionText: string;

  transitionSettled: boolean;
  error: string | null;
  busy: boolean;
  savedStep: PassageStep;
};

export type PassageAction =
  | { type: "boot"; staticMode: boolean; resume: MemberPassage | null }
  | { type: "begin" }
  | { type: "opening_ended" }
  | { type: "set_role"; role: string }
  | { type: "set_role_other"; text: string }
  | { type: "submit_role" }
  | { type: "recognition_ended" }
  | { type: "set_entry"; text: string }
  | { type: "finish_entry" }
  | { type: "set_support"; text: string }
  | { type: "finish_support" }
  | { type: "set_function"; text: string }
  | { type: "finish_function" }
  | { type: "finish_look" }
  | { type: "back_to_awaken" }
  | { type: "back_to_role" }
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
  roleTitle: "",
  roleTitleOther: "",
  entryText: "",
  supportsText: "",
  functionText: "",
  transitionSettled: false,
  error: null,
  busy: false,
  savedStep: "role",
};

/** Where a saved step resumes. Never a transition. */
const RESUME_PHASE: Record<PassageStep, PassagePhase> = {
  role: "role_idle",
  entry: "entry_idle",
  support: "support_idle",
  function: "function_idle",
  look: "look_idle",
  story: "story_scroll",
  complete: "complete",
};

export const PASSAGE_PHASE_LOOP: Partial<Record<PassagePhase, OriginMediaKey>> = {
  role_idle: "loop02",
  entry_idle: "loop03",
  support_idle: "loop04",
  function_idle: "loop05",
  look_idle: "loop05",
  story_scroll: "scroll06",
  saving: "scroll06",
  complete: "scroll06",
};

export const PASSAGE_PHASE_TRANSITION: Partial<Record<PassagePhase, OriginMediaKey>> = {
  opening: "opening01To02",
  recognizing: "transition02To03",
  entry_transition: "transition03To04",
  support_transition: "transition04To05",
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
          phase: staticMode ? "role_idle" : "awaiting_start",
        };
      }
      const savedStep = resume.currentStep;
      return {
        ...state,
        staticMode,
        roleTitle: resume.roleTitle ?? "",
        roleTitleOther: resume.roleTitleOther ?? "",
        entryText: resume.entryText ?? "",
        supportsText: resume.supportsText ?? "",
        functionText: resume.functionText ?? "",
        transitionSettled: true,
        savedStep,
        phase: RESUME_PHASE[savedStep],
      };
    }

    case "begin":
      return state.phase === "awaiting_start"
        ? { ...state, phase: state.staticMode ? "role_idle" : "opening" }
        : state;

    case "opening_ended":
      return state.phase === "opening" ? { ...state, phase: "role_idle" } : state;

    case "set_role":
      return { ...state, roleTitle: action.role, error: null };

    case "set_role_other":
      return { ...state, roleTitleOther: action.text, error: null };

    case "submit_role":
      if (state.phase !== "role_idle" || state.busy) return state;
      if (!state.roleTitle.trim()) return state;
      return {
        ...state,
        phase: state.staticMode ? "entry_idle" : "recognizing",
        savedStep: "entry",
        error: null,
      };

    case "recognition_ended":
      return state.phase === "recognizing" ? { ...state, phase: "entry_idle" } : state;

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
      return {
        ...state,
        phase: state.staticMode ? "function_idle" : "support_transition",
        savedStep: "function",
        error: null,
      };

    case "set_function":
      return { ...state, functionText: action.text, error: null };

    case "finish_function":
      if (state.busy || state.phase !== "function_idle") return state;
      // Look shares loop05 with the question before it — the film has already
      // arrived at that beat, so no transition plays between the two.
      return { ...state, phase: "look_idle", savedStep: "look", error: null };

    case "finish_look":
      if (state.busy || state.phase !== "look_idle") return state;
      return {
        ...state,
        phase: state.staticMode ? "story_scroll" : "chapter_opening",
        savedStep: "story",
        error: null,
      };

    case "back_to_awaken":
      return state.phase === "role_idle"
        ? { ...state, phase: "awaiting_start", savedStep: "role", error: null }
        : state;

    case "back_to_role":
      return state.phase === "entry_idle"
        ? { ...state, phase: "role_idle", savedStep: "role", error: null }
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
      return state.phase === "look_idle" || state.phase === "story_scroll"
        ? { ...state, phase: "function_idle", savedStep: "function", error: null, busy: false }
        : state;

    case "transition_ended": {
      if (state.phase === "entry_transition") {
        return { ...state, phase: "support_idle", transitionSettled: true };
      }
      if (state.phase === "support_transition") {
        return { ...state, phase: "function_idle", transitionSettled: true };
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
