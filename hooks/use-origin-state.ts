"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import {
  completeArtistOrigin,
  fetchArtistOrigin,
  requestInterpretation,
  saveOriginDraft,
  skipArtistOrigin,
} from "@/lib/api/artist-origin";
import {
  INITIAL_ORIGIN_STATE,
  originReducer,
  type OriginAction,
  type OriginState,
} from "@/lib/origin/reducer";
import type {
  ArtistOrigin,
  ArtistOriginInterpretation,
  OriginStep,
} from "@/lib/origin/types";
import { prefersReducedMotion, networkProfile } from "@/lib/origin/readiness";

/**
 * Wires the ORIGIN state machine to the artist record and to draft persistence.
 *
 * Draft saves are fire-and-forget and debounced: a failed autosave must never
 * interrupt the experience, because everything is still in memory and the
 * artist is about to save again anyway. Only the final completion surfaces its
 * errors, since that is the one write the artist is waiting on.
 */

const DRAFT_DEBOUNCE_MS = 900;
const LOCAL_DRAFT_PREFIX = "tempo.originDraft:";
const RESUME_STEPS = new Set<OriginStep>([
  "name",
  "introduction",
  "processing",
  "review",
  "story",
  "complete",
]);

type LocalOriginDraft = {
  currentStep: OriginStep;
  artistNameDraft: string | null;
  introductionText: string | null;
  directionText: string | null;
  interpretation: ArtistOriginInterpretation | null;
  savedAt: string;
};

function localDraftKey(artistId: string) {
  return `${LOCAL_DRAFT_PREFIX}${artistId}`;
}

function readLocalDraft(artistId: string): ArtistOrigin | null {
  try {
    const raw = localStorage.getItem(localDraftKey(artistId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalOriginDraft;
    if (!RESUME_STEPS.has(draft.currentStep) || !draft.savedAt) return null;
    return {
      artistId,
      status: "in_progress",
      currentStep: draft.currentStep,
      artistNameDraft: draft.artistNameDraft ?? null,
      introductionText: draft.introductionText ?? null,
      directionText: draft.directionText ?? null,
      interpretation: draft.interpretation ?? null,
      generationVersion: 0,
      generatedAt: null,
      completedAt: null,
      updatedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(artistId: string, state: OriginState) {
  try {
    const draft: LocalOriginDraft = {
      currentStep: state.savedStep,
      artistNameDraft: state.name || null,
      introductionText: state.introduction || null,
      directionText: state.direction || null,
      interpretation: state.interpretationReady ? state.interpretation : null,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(localDraftKey(artistId), JSON.stringify(draft));
  } catch {
    // Cloud autosave remains the primary path when local storage is unavailable.
  }
}

function removeLocalDraft(artistId: string) {
  try {
    localStorage.removeItem(localDraftKey(artistId));
  } catch {
    // Nothing else depends on local cleanup.
  }
}

function newestDraft(
  cloud: ArtistOrigin | null,
  local: ArtistOrigin | null
): ArtistOrigin | null {
  if (cloud?.status === "complete" || cloud?.status === "skipped") return cloud;
  if (!local) return cloud;
  if (!cloud) return local;
  const cloudTime = cloud.updatedAt ? Date.parse(cloud.updatedAt) : 0;
  const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;
  return localTime > cloudTime ? local : cloud;
}

export type OriginController = {
  state: OriginState;
  dispatch: React.Dispatch<OriginAction>;
  artistId: string | null;
  hydrated: boolean;
  /** Interpretation, running in parallel with the covering transition. */
  runInterpretation: () => void;
  regenerate: () => void;
  complete: () => Promise<boolean>;
  skip: () => Promise<void>;
  setInterpretation: (i: ArtistOriginInterpretation) => void;
};

export function useOriginState(revisit = false, replay = false): OriginController {
  const { activeArtist } = useActiveArtist() as {
    activeArtist: { id: string; name: string } | null;
  };
  const artistId = activeArtist?.id ?? null;

  const [state, dispatch] = React.useReducer(originReducer, INITIAL_ORIGIN_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  const stateRef = React.useRef(state);
  stateRef.current = state;
  const bootedRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = React.useRef(false);

  /** Boot: load any saved draft and resume at its stable step. */
  React.useEffect(() => {
    if (!artistId || bootedRef.current) return;
    bootedRef.current = true;

    const staticMode = prefersReducedMotion() || networkProfile() === "save-data";
    let cancelled = false;
    let settled = false;

    void (async () => {
      let cloudResume: ArtistOrigin | null = null;
      try {
        cloudResume = await fetchArtistOrigin(artistId);
      } catch {
        // The same-browser safety copy can still resume a failed cloud read.
      }
      const localResume = readLocalDraft(artistId);
      const resume = newestDraft(cloudResume, localResume);
      if (cloudResume?.status === "complete" || cloudResume?.status === "skipped") {
        removeLocalDraft(artistId);
      }
      if (cancelled) return;
      dispatch({
        type: "boot",
        staticMode,
        // Replay deliberately ignores any saved draft so the film runs from the
        // very top — that is the whole point of the action.
        resume: replay
          ? null
          : revisit
          ? // Revisit opens straight into the editable story with the confirmed
            // content — the opening film only plays if deliberately asked for.
            resume
            ? { ...resume, currentStep: "story" as const }
            : null
          : // A completed or skipped row is never auto-resumed into.
            resume && resume.status === "in_progress"
            ? resume
            : null,
      });
      // Seed the name from the artist record when there is no draft yet.
      if (!resume?.artistNameDraft && activeArtist?.name) {
        dispatch({ type: "set_name", name: activeArtist.name });
      }
      settled = true;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
      // If the read hadn't landed yet, let the next run redo it.
      //
      // Without this, ORIGIN could hang on its black floor forever. The effect
      // is torn down and re-run whenever its deps change — `activeArtist?.name`
      // arrives a beat after `artistId` does, and React's dev double-invoke
      // does the same thing on mount. The re-run then hit the `bootedRef`
      // guard and returned immediately, while the cancelled first run bailed at
      // `if (cancelled)` just before setting `hydrated`. Nothing was left to
      // finish the boot.
      if (!settled) bootedRef.current = false;
    };
  }, [artistId, activeArtist?.name, revisit, replay]);

  /**
   * Immediate same-browser safety copy. The cloud write below is authoritative,
   * but its debounce can be interrupted by a tab closing just after a keystroke
   * or step change. This synchronous copy closes that small gap.
   */
  React.useEffect(() => {
    if (!hydrated || !artistId) return;
    writeLocalDraft(artistId, state);
  }, [
    hydrated,
    artistId,
    state.savedStep,
    state.name,
    state.introduction,
    state.direction,
    state.interpretation,
    state.interpretationReady,
  ]);

  /** Debounced draft save whenever meaningful content changes. */
  React.useEffect(() => {
    if (!hydrated || !artistId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      void saveOriginDraft(artistId, {
        currentStep: s.savedStep,
        artistNameDraft: s.name || null,
        introductionText: s.introduction || null,
        directionText: s.direction || null,
        interpretation: s.interpretationReady ? s.interpretation : undefined,
      }).catch(() => {
        // Silent: nothing is lost, and the next save will carry it.
      });
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    hydrated,
    artistId,
    state.savedStep,
    state.name,
    state.introduction,
    state.direction,
    state.interpretation,
    state.interpretationReady,
  ]);

  const runInterpretation = React.useCallback(() => {
    if (!artistId || inFlightRef.current) return;
    inFlightRef.current = true;
    const s = stateRef.current;

    void requestInterpretation({
      artistId,
      artistName: s.name,
      introduction: s.introduction,
      direction: s.direction,
    })
      .then((interpretation) => {
        // The reducer decides whether this can be shown yet — a fast response
        // must not cut the transition short.
        dispatch({ type: "interpretation_ok", interpretation });
      })
      .catch((err: unknown) => {
        dispatch({
          type: "interpretation_failed",
          message:
            err instanceof Error ? err.message : "TEMPO couldn't read that just now.",
        });
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [artistId]);

  const regenerate = React.useCallback(() => {
    if (!artistId || inFlightRef.current) return;
    inFlightRef.current = true;
    dispatch({ type: "set_busy", busy: true });
    const s = stateRef.current;

    void requestInterpretation({
      artistId,
      artistName: s.name,
      introduction: s.introduction,
      direction: s.direction,
    })
      .then((interpretation) => {
        // Held aside — the visible interpretation is untouched until accepted.
        dispatch({ type: "regeneration_ok", interpretation });
      })
      .catch((err: unknown) => {
        dispatch({
          type: "save_failed",
          message:
            err instanceof Error ? err.message : "That didn't come back. Try again.",
        });
      })
      .finally(() => {
        inFlightRef.current = false;
        dispatch({ type: "set_busy", busy: false });
      });
  }, [artistId]);

  const complete = React.useCallback(async (): Promise<boolean> => {
    if (!artistId) return false;
    const s = stateRef.current;
    if (s.busy) return false;

    dispatch({ type: "begin_save" });
    try {
      await completeArtistOrigin({
        artistId,
        artistName: s.name,
        introduction: s.introduction,
        direction: s.direction,
        interpretation: s.interpretation,
      });
      removeLocalDraft(artistId);
      dispatch({ type: "save_ok" });
      return true;
    } catch (err) {
      dispatch({
        type: "save_failed",
        message:
          err instanceof Error
            ? "That didn't save. Your writing is still here — try again."
            : "That didn't save. Try again.",
      });
      return false;
    }
  }, [artistId]);

  const skip = React.useCallback(async () => {
    if (!artistId) return;
    const s = stateRef.current;
    // The draft is written first so skipping loses nothing.
    try {
      await saveOriginDraft(artistId, {
        currentStep: s.savedStep,
        artistNameDraft: s.name || null,
        introductionText: s.introduction || null,
        directionText: s.direction || null,
      });
    } catch {
      /* skipping must not be blocked by a failed draft save */
    }
    try {
      await skipArtistOrigin(artistId);
      removeLocalDraft(artistId);
    } catch {
      /* the redirect still happens; status can be set again later */
    }
  }, [artistId]);

  const setInterpretation = React.useCallback((i: ArtistOriginInterpretation) => {
    dispatch({ type: "edit_interpretation", interpretation: i });
  }, []);

  return {
    state,
    dispatch,
    artistId,
    hydrated,
    runInterpretation,
    regenerate,
    complete,
    skip,
    setInterpretation,
  };
}
