"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearArtistEmblem,
  clearArtistLogo,
  deleteArtist,
  ensureDefaultArtist,
  fetchArtists,
  renameArtist,
  reorderArtists,
  setArtistBannerColor,
  setArtistCustomAccent,
  updateArtistPalette,
  uploadArtistBanner,
  uploadArtistEmblem,
  uploadArtistLogo,
} from "@/lib/api/artists";
import { ACTIVE_ARTIST_KEY } from "@/lib/constants";
import { resolveArtistHues, type ResolvedArtistHues } from "@/lib/artist-theme";
import type { Artist } from "@/lib/types";

type ActiveArtistContextValue = {
  artists: Artist[];
  activeArtist: Artist | null;
  activeArtistId: string | null;
  setActiveArtistId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const ActiveArtistContext = React.createContext<ActiveArtistContextValue | null>(
  null
);

function readStoredArtistId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_ARTIST_KEY);
  } catch {
    return null;
  }
}

function writeStoredArtistId(id: string) {
  try {
    localStorage.setItem(ACTIVE_ARTIST_KEY, id);
  } catch {
    /* ignore */
  }
}

async function bootstrapArtists(): Promise<Artist[]> {
  await ensureDefaultArtist();
  return fetchArtists();
}

export function ActiveArtistProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeArtistId, setActiveArtistIdState] = React.useState<string | null>(
    null
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setActiveArtistIdState(readStoredArtistId());
    setHydrated(true);
  }, []);

  const artistsQuery = useQuery({
    queryKey: ["artists"],
    queryFn: bootstrapArtists,
    enabled: hydrated,
  });

  const artists = React.useMemo(
    () => artistsQuery.data ?? [],
    [artistsQuery.data]
  );

  React.useEffect(() => {
    if (!artists.length) return;
    const stillValid =
      activeArtistId && artists.some((a) => a.id === activeArtistId);
    if (!stillValid) {
      const next = artists[0].id;
      setActiveArtistIdState(next);
      writeStoredArtistId(next);
    }
  }, [artists, activeArtistId]);

  const setActiveArtistId = React.useCallback((id: string) => {
    setActiveArtistIdState(id);
    writeStoredArtistId(id);
  }, []);

  const activeArtist =
    artists.find((a) => a.id === activeArtistId) ?? artists[0] ?? null;

  const value: ActiveArtistContextValue = {
    artists,
    activeArtist,
    activeArtistId: activeArtist?.id ?? null,
    setActiveArtistId,
    isLoading: !hydrated || artistsQuery.isLoading,
    isError: artistsQuery.isError,
    error: artistsQuery.error as Error | null,
  };

  return (
    <ActiveArtistContext.Provider value={value}>
      {children}
    </ActiveArtistContext.Provider>
  );
}

export function useActiveArtist() {
  const ctx = React.useContext(ActiveArtistContext);
  if (!ctx) {
    throw new Error("useActiveArtist must be used within ActiveArtistProvider");
  }
  return ctx;
}

/**
 * Resolved hex for the active artist's palette — for canvas/wavesurfer
 * consumers that can't read CSS vars.
 *
 * Deliberately does NOT throw outside the provider: shared presentational
 * components (placeholder covers, players) also render on the public guest
 * review page, where there is no signed-in artist. There they fall back to
 * the default Spectra hues.
 */
export function useActiveArtistPalette(): ResolvedArtistHues {
  const ctx = React.useContext(ActiveArtistContext);
  const paletteId = ctx?.activeArtist?.palette_id;
  const ice = ctx?.activeArtist?.ice_color;
  const amber = ctx?.activeArtist?.amber_color;
  // Stable identity per palette — callers put this in useMemo/useEffect deps
  // (the waveform rebuilds on change), so a fresh object each render would thrash.
  return React.useMemo(
    () => resolveArtistHues(paletteId, { ice, amber }),
    [paletteId, ice, amber]
  );
}

export function useArtistMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["artists"] });

  const patchArtist = (updated: Artist) => {
    qc.setQueryData<Artist[]>(["artists"], (prev) =>
      prev
        ? prev.map((a) => (a.id === updated.id ? updated : a))
        : prev
    );
  };

  const create = useMutation({
    mutationFn: ({ name, sort }: { name: string; sort: number }) =>
      import("@/lib/api/artists").then((m) => m.createArtist(name, sort)),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameArtist(id, name),
    onSuccess: invalidate,
  });

  const updatePalette = useMutation({
    mutationFn: ({ id, paletteId }: { id: string; paletteId: string }) =>
      updateArtistPalette(id, paletteId),
    onMutate: async ({ id, paletteId }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  palette_id: paletteId,
                  ice_color: null,
                  amber_color: null,
                }
              : a
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSuccess: (updated) => patchArtist(updated),
    onSettled: invalidate,
  });

  const setCustomAccent = useMutation({
    mutationFn: ({
      artist,
      ice,
      amber,
    }: {
      artist: Artist;
      ice: string;
      amber: string;
    }) => setArtistCustomAccent(artist, { ice, amber }),
    onMutate: async ({ artist, ice, amber }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id
              ? { ...a, ice_color: ice, amber_color: amber }
              : a
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSuccess: (updated) => patchArtist(updated),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteArtist(id),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (ordered: { id: string; sort: number }[]) =>
      reorderArtists(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        const byId = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<Artist[]>(
          ["artists"],
          [...prev]
            .map((a) => ({ ...a, sort: byId.get(a.id) ?? a.sort }))
            .sort((a, b) => a.sort - b.sort)
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSettled: invalidate,
  });

  type ImageMutCtx = { prev?: Artist[]; preview?: string };

  const uploadLogo = useMutation({
    mutationFn: ({ artist, file }: { artist: Artist; file: File }) =>
      uploadArtistLogo(artist, file),
    onMutate: async ({ artist, file }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      const preview = URL.createObjectURL(file);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id ? { ...a, logo_url: preview } : a
          )
        );
      }
      return { prev, preview } satisfies ImageMutCtx;
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
    },
    onSuccess: (updated, _v, ctx) => {
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
      patchArtist(updated);
    },
    onSettled: invalidate,
  });

  const uploadBanner = useMutation({
    mutationFn: ({ artist, file }: { artist: Artist; file: File }) =>
      uploadArtistBanner(artist, file),
    onMutate: async ({ artist, file }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      const preview = URL.createObjectURL(file);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id
              ? {
                  ...a,
                  banner_url: preview,
                  banner_color: null,
                  banner_color_end: null,
                }
              : a
          )
        );
      }
      return { prev, preview } satisfies ImageMutCtx;
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
    },
    onSuccess: (updated, _v, ctx) => {
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
      patchArtist(updated);
    },
    onSettled: invalidate,
  });

  const clearLogo = useMutation({
    mutationFn: (artist: Artist) => clearArtistLogo(artist),
    onMutate: async (artist) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id ? { ...a, logo_url: null } : a
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSuccess: (updated) => patchArtist(updated),
    onSettled: invalidate,
  });

  const uploadEmblem = useMutation({
    mutationFn: ({ artist, file }: { artist: Artist; file: File }) =>
      uploadArtistEmblem(artist, file),
    onMutate: async ({ artist, file }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      const preview = URL.createObjectURL(file);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id ? { ...a, emblem_url: preview } : a
          )
        );
      }
      return { prev, preview } satisfies ImageMutCtx;
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
    },
    onSuccess: (updated, _v, ctx) => {
      if (ctx?.preview) URL.revokeObjectURL(ctx.preview);
      patchArtist(updated);
    },
    onSettled: invalidate,
  });

  const clearEmblem = useMutation({
    mutationFn: (artist: Artist) => clearArtistEmblem(artist),
    onMutate: async (artist) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id ? { ...a, emblem_url: null } : a
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSuccess: (updated) => patchArtist(updated),
    onSettled: invalidate,
  });

  const setBannerColor = useMutation({
    mutationFn: ({
      artist,
      color,
      colorEnd = null,
    }: {
      artist: Artist;
      color: string | null;
      colorEnd?: string | null;
    }) => setArtistBannerColor(artist, color, colorEnd),
    onMutate: async ({ artist, color, colorEnd = null }) => {
      await qc.cancelQueries({ queryKey: ["artists"] });
      const prev = qc.getQueryData<Artist[]>(["artists"]);
      if (prev) {
        qc.setQueryData<Artist[]>(
          ["artists"],
          prev.map((a) =>
            a.id === artist.id
              ? {
                  ...a,
                  banner_color: color,
                  banner_color_end: color ? colorEnd : null,
                  banner_url: null,
                }
              : a
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["artists"], ctx.prev);
    },
    onSuccess: (updated) => patchArtist(updated),
    onSettled: invalidate,
  });

  return {
    create,
    rename,
    updatePalette,
    setCustomAccent,
    remove,
    reorder,
    uploadLogo,
    clearLogo,
    uploadEmblem,
    clearEmblem,
    uploadBanner,
    setBannerColor,
  };
}
