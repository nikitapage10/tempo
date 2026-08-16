"use client";

import * as React from "react";
import {
  completeMemberPassage,
  fetchMemberPassage,
  requestPassageInterpretation,
  saveMemberPassageDraft,
  skipMemberPassage,
} from "@/lib/api/member-passage";
import {
  INITIAL_PASSAGE_STATE,
  passageReducer,
  type PassageAction,
  type PassageState,
} from "@/lib/passage/reducer";
import type { MemberPassage, PassageInterpretation } from "@/lib/passage/types";
import { normalizePersonDisplayName } from "@/lib/auth/person-name";
import { updateMyMemberProfile } from "@/lib/api/member-profile";
import { prefersReducedMotion, networkProfile } from "@/lib/origin/readiness";

/**
 * Wires the PASSAGE state machine to draft persistence. Mirrors
 * hooks/use-origin-state.ts: autosave is fire-and-forget and debounced, and
 * only the final completion surfaces its errors.
 */

const DRAFT_DEBOUNCE_MS = 900;

/** The chips plus any free-text answer, as one list for the writer. */
function rolesFor(roleTitles: string[], other: string): string[] {
  const extra = other.trim();
  return extra ? [...roleTitles, extra] : roleTitles;
}

export type PassageController = {
  state: PassageState;
  dispatch: React.Dispatch<PassageAction>;
  hydrated: boolean;
  /** Reads the answers and writes the closing story. Never throws. */
  runInterpretation: () => void;
  setInterpretation: (interpretation: PassageInterpretation) => void;
  complete: () => Promise<boolean>;
  /** "Skip for now" always resolves, so leaving is never blocked. */
  skip: () => Promise<void>;
};

export function usePassageState(): PassageController {
  const [state, dispatch] = React.useReducer(passageReducer, INITIAL_PASSAGE_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  const stateRef = React.useRef(state);
  stateRef.current = state;
  const bootedRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const staticMode = prefersReducedMotion() || networkProfile() === "save-data";

    void (async () => {
      let resume: MemberPassage | null = null;
      try {
        const row = await fetchMemberPassage();
        if (row && row.status === "in_progress") resume = row;
      } catch {
        // Falls back to starting fresh. Nothing has been lost yet.
      }
      dispatch({ type: "boot", staticMode, resume });
      setHydrated(true);
    })();
  }, []);

  const draftOf = (s: PassageState) => ({
    currentStep: s.savedStep,
    displayName: s.displayName || null,
    roleTitles: s.roleTitles,
    roleTitleOther: s.roleTitleOther || null,
    entryText: s.entryText || null,
    supportsText: s.supportsText || null,
    functionText: s.functionText || null,
    interpretation: s.interpretationReady ? s.interpretation : undefined,
  });

  React.useEffect(() => {
    if (!hydrated) return;
    // Do not turn merely viewing the waking screen into a resumable draft.
    // A row created here would reopen at the name step and bypass the Tune in
    // gesture that starts Passage's soundtrack in web browsers.
    if (state.phase === "awaiting_start") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      void saveMemberPassageDraft(draftOf(stateRef.current)).catch(() => {
        // Silent: nothing is lost, and the next save will carry it.
      });
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    state.phase,
    state.savedStep,
    state.displayName,
    state.roleTitles,
    state.roleTitleOther,
    state.entryText,
    state.supportsText,
    state.functionText,
    state.interpretation,
    state.interpretationReady,
  ]);

  const inFlightRef = React.useRef(false);

  const runInterpretation = React.useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const s = stateRef.current;

    void requestPassageInterpretation({
      displayName: s.displayName,
      roles: rolesFor(s.roleTitles, s.roleTitleOther),
      entry: s.entryText,
      supports: s.supportsText,
      work: s.functionText,
    })
      .then((interpretation) => {
        dispatch({ type: "interpretation_ok", interpretation });
      })
      .catch(() => {
        // The recap falls back to their own answers, so this is never fatal.
        dispatch({ type: "interpretation_failed" });
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, []);

  const setInterpretation = React.useCallback((interpretation: PassageInterpretation) => {
    dispatch({ type: "edit_interpretation", interpretation });
  }, []);

  /**
   * Passage is now the only place a Pro is asked for their name, so it owns
   * publishing it. Without this their personal home stays labelled "Home" and
   * artists see that instead of a person.
   */
  const publishName = React.useCallback(async (raw: string) => {
    const named = normalizePersonDisplayName(raw);
    if (!named) return;
    try {
      await updateMyMemberProfile({ displayName: named });
    } catch {
      /* the name is still on the passage row and editable from Profile */
    }
  }, []);

  const complete = React.useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (s.busy) return false;
    dispatch({ type: "begin_save" });
    await publishName(s.displayName);
    try {
      await completeMemberPassage({
        displayName: s.displayName,
        roleTitles: s.roleTitles,
        roleTitleOther: s.roleTitleOther,
        entryText: s.entryText,
        supportsText: s.supportsText,
        functionText: s.functionText,
        interpretation: s.interpretation,
      });
      dispatch({ type: "save_ok" });
      return true;
    } catch {
      dispatch({
        type: "save_failed",
        message: "That didn't save. Your writing is still here, so try again.",
      });
      return false;
    }
  }, [publishName]);

  const skip = React.useCallback(async () => {
    // A name given before skipping is still a name they chose to give.
    await publishName(stateRef.current.displayName);
    // Written first so skipping loses nothing that was already typed.
    try {
      await saveMemberPassageDraft(draftOf(stateRef.current));
    } catch {
      /* skipping must not be blocked by a failed draft save */
    }
    try {
      await skipMemberPassage();
    } catch {
      /* the redirect still happens; status can be set again later */
    }
    // draftOf reads only from stateRef, so it needs no dependency of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishName]);

  return {
    state,
    dispatch,
    hydrated,
    runInterpretation,
    setInterpretation,
    complete,
    skip,
  };
}
