"use client";

import * as React from "react";
import {
  completeMemberPassage,
  fetchMemberPassage,
  saveMemberPassageDraft,
  skipMemberPassage,
} from "@/lib/api/member-passage";
import {
  INITIAL_PASSAGE_STATE,
  passageReducer,
  type PassageAction,
  type PassageState,
} from "@/lib/passage/reducer";
import { prefersReducedMotion, networkProfile } from "@/lib/origin/readiness";

/**
 * Wires the PASSAGE state machine to draft persistence. Mirrors
 * hooks/use-origin-state.ts: autosave is fire-and-forget and debounced, and
 * only the final completion surfaces its errors.
 */

const DRAFT_DEBOUNCE_MS = 900;

export type PassageController = {
  state: PassageState;
  dispatch: React.Dispatch<PassageAction>;
  hydrated: boolean;
  complete: () => Promise<boolean>;
  /** "Skip for now" — always resolves, so leaving is never blocked. */
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
      let resume = null;
      try {
        const row = await fetchMemberPassage();
        if (row && row.status === "in_progress") resume = row;
      } catch {
        // Falls back to starting fresh — nothing has been lost yet.
      }
      dispatch({ type: "boot", staticMode, resume });
      setHydrated(true);
    })();
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      void saveMemberPassageDraft({
        currentStep: s.savedStep,
        roleTitle: s.roleTitle || null,
        roleTitleOther: s.roleTitleOther || null,
        entryText: s.entryText || null,
        supportsText: s.supportsText || null,
        functionText: s.functionText || null,
      }).catch(() => {
        // Silent: nothing is lost, and the next save will carry it.
      });
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    hydrated,
    state.savedStep,
    state.roleTitle,
    state.roleTitleOther,
    state.entryText,
    state.supportsText,
    state.functionText,
  ]);

  const complete = React.useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (s.busy) return false;
    dispatch({ type: "begin_save" });
    try {
      await completeMemberPassage({
        roleTitle: s.roleTitle,
        roleTitleOther: s.roleTitleOther,
        entryText: s.entryText,
        supportsText: s.supportsText,
        functionText: s.functionText,
      });
      dispatch({ type: "save_ok" });
      return true;
    } catch {
      dispatch({
        type: "save_failed",
        message: "That didn't save. Your writing is still here — try again.",
      });
      return false;
    }
  }, []);

  const skip = React.useCallback(async () => {
    const s = stateRef.current;
    // Written first so skipping loses nothing that was already typed.
    try {
      await saveMemberPassageDraft({
        currentStep: s.savedStep,
        roleTitle: s.roleTitle || null,
        roleTitleOther: s.roleTitleOther || null,
        entryText: s.entryText || null,
        supportsText: s.supportsText || null,
        functionText: s.functionText || null,
      });
    } catch {
      /* skipping must not be blocked by a failed draft save */
    }
    try {
      await skipMemberPassage();
    } catch {
      /* the redirect still happens; status can be set again later */
    }
  }, []);

  return { state, dispatch, hydrated, complete, skip };
}
