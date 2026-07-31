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
import type { ArtistOriginInterpretation } from "@/lib/origin/types";
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

export function useOriginState(revisit = false): OriginController {
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

    void (async () => {
      let resume = null;
      try {
        resume = await fetchArtistOrigin(artistId);
      } catch {
        // A failed read is not fatal — start fresh rather than block the flow.
      }
      if (cancelled) return;
      dispatch({
        type: "boot",
        staticMode,
        resume: revisit
          ? // Revisit opens straight into the editable story with the confirmed
            // content — the opening film only plays if deliberately asked for.
            resume
            ? { ...resume, currentStep: "review" as const }
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
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [artistId, activeArtist?.name, revisit]);

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
        interpretation: s.interpretation,
      });
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
      });
    } catch {
      /* skipping must not be blocked by a failed draft save */
    }
    try {
      await skipArtistOrigin(artistId);
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
