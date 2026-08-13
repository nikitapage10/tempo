"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearArtistLayoutPref,
  fetchArtistLayoutPref,
  saveArtistLayoutPref,
} from "@/lib/api/artist-layout";
import {
  clearLegacyLocalArtistLayout,
  readLegacyLocalArtistLayout,
  sanitizeArtistLayout,
  type GamificationPreference,
} from "@/lib/artist-layout";
import {
  DEFAULT_ARTIST_LAYOUT,
  type ModuleLayout,
} from "@/lib/workspace-presets";

const DEFAULT_GAMIFICATION: GamificationPreference = { display: "full" };

/**
 * The artist overview's saved arrangement, per artist — stored in Supabase
 * (migration 027) so it follows the signed-in person across devices, rather
 * than staying stuck to whichever browser last saved it. Carries the
 * gamification display preference (full/dim) in the same row, since both
 * live in one jsonb envelope — every save writes both together so editing
 * the layout never silently resets the other.
 *
 * On the first successful fetch that finds nothing in the database yet, a
 * pre-migration 027 localStorage value (if this browser has one) is carried
 * over once and the local copy is cleared, so nobody's existing arrangement
 * is silently dropped by the switch.
 */
export function useArtistLayout(artistId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["artist-layout", artistId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchArtistLayoutPref(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: ({
      layout,
      gamification,
    }: {
      layout: ModuleLayout;
      gamification: GamificationPreference;
    }) => saveArtistLayoutPref(artistId!, layout, gamification),
    onSuccess: (pref) => qc.setQueryData(queryKey, pref),
  });

  const clear = useMutation({
    mutationFn: () => clearArtistLayoutPref(artistId!),
    onSuccess: () => qc.setQueryData(queryKey, null),
  });

  const saveMutate = save.mutate;
  React.useEffect(() => {
    if (!artistId || !query.isSuccess || query.data !== null) return;
    const legacy = readLegacyLocalArtistLayout(artistId);
    if (!legacy) return;
    // Only ever runs once per artist per browser: fires right after a fetch
    // finds nothing saved, and clearing the local copy stops it firing again.
    saveMutate(
      { layout: legacy, gamification: DEFAULT_GAMIFICATION },
      { onSuccess: () => clearLegacyLocalArtistLayout(artistId) }
    );
  }, [artistId, query.isSuccess, query.data, saveMutate]);

  const layout = query.data?.layout ?? DEFAULT_ARTIST_LAYOUT;
  const gamification = query.data?.gamification ?? DEFAULT_GAMIFICATION;

  function setLayout(next: ModuleLayout) {
    save.mutate({ layout: sanitizeArtistLayout(next), gamification });
  }

  function setGamification(next: GamificationPreference) {
    save.mutate({ layout, gamification: next });
  }

  function reset() {
    clear.mutate();
  }

  return {
    layout,
    setLayout,
    gamification,
    setGamification,
    reset,
    loaded: query.isSuccess || query.isError,
  };
}
