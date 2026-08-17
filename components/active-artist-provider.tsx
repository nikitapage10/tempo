"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearArtistEmblem,
  clearArtistLogo,
  deleteArtist,
  ensureArtists,
  renameArtist,
  reorderArtists,
  setArtistBannerColor,
  setArtistCustomAccent,
  updateArtistPalette,
  uploadArtistBanner,
  uploadArtistEmblem,
  uploadArtistLogo,
} from "@/lib/api/artists";
import {
  PREFER_DEMO_ARTIST_KEY,
  PREFER_ORIGIN_ARTIST_KEY,
} from "@/lib/constants";
import {
  readStoredArtistId,
  writeStoredArtistId,
} from "@/lib/auth/workspace-memory";
import { resolveArtistHues, type ResolvedArtistHues } from "@/lib/artist-theme";
import {
  classifyOwnedKind,
  membershipArtists,
  ownedPersonalWorkspace,
  pickResumeArtistId,
} from "@/lib/workspace-mode";
import { useCurrentUser } from "@/hooks/use-current-user";
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

async function bootstrapArtists(): Promise<Artist[]> {
  return ensureArtists();
}

function readPreferOriginArtistId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PREFER_ORIGIN_ARTIST_KEY);
  } catch {
    return null;
  }
}

function readPreferDemoArtistId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PREFER_DEMO_ARTIST_KEY);
  } catch {
    return null;
  }
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
  const explicitDemoActiveRef = React.useRef(false);
  const user = useCurrentUser();
  const userResolved = user !== undefined;

  React.useEffect(() => {
    if (!userResolved) return;
    explicitDemoActiveRef.current = false;
    setActiveArtistIdState(readStoredArtistId(user?.id ?? null));
    setHydrated(true);
  }, [user?.id, userResolved]);

  const artistsQuery = useQuery({
    queryKey: ["artists"],
    queryFn: bootstrapArtists,
    enabled: hydrated && !!user?.id,
  });

  const artists = React.useMemo(
    () => artistsQuery.data ?? [],
    [artistsQuery.data]
  );

  React.useEffect(() => {
    if (!artists.length) return;
    const userId = user?.id ?? null;
    const preferDemo = readPreferDemoArtistId();
    if (preferDemo && artists.some((a) => a.id === preferDemo && a.demo_kind)) {
      explicitDemoActiveRef.current = true;
      try {
        sessionStorage.removeItem(PREFER_DEMO_ARTIST_KEY);
      } catch {
        /* ignore */
      }
      setActiveArtistIdState(preferDemo);
      writeStoredArtistId(userId, preferDemo);
      return;
    }
    let preferOrigin: string | null = readPreferOriginArtistId();
    if (preferOrigin && artists.some((a) => a.id === preferOrigin)) {
      setActiveArtistIdState(preferOrigin);
      writeStoredArtistId(userId, preferOrigin);
      return;
    }
    let preferPersonal: string | null = null;
    try {
      preferPersonal = sessionStorage.getItem("tempo.preferPersonalHome");
    } catch {
      preferPersonal = null;
    }
    if (preferPersonal && artists.some((a) => a.id === preferPersonal)) {
      try {
        sessionStorage.removeItem("tempo.preferPersonalHome");
      } catch {
        /* ignore */
      }
      setActiveArtistIdState(preferPersonal);
      writeStoredArtistId(userId, preferPersonal);
      return;
    }
    const keeper = ownedPersonalWorkspace(artists, userId);
    const active = artists.find((a) => a.id === activeArtistId);
    // A demo that was explicitly opened is valid for this mounted session.
    // A stored demo pointer restored by a later login is not: Pros wake in
    // their own home and can choose the demo again from the switcher.
    if (
      keeper &&
      active?.demo_kind &&
      !explicitDemoActiveRef.current
    ) {
      setActiveArtistIdState(keeper.id);
      writeStoredArtistId(userId, keeper.id);
      return;
    }
    const stillValid = !!active;
    if (!stillValid) {
      const next =
        pickResumeArtistId(artists, userId, activeArtistId) ?? artists[0].id;
      setActiveArtistIdState(next);
      writeStoredArtistId(userId, next);
      return;
    }
    const hasMembership = membershipArtists(artists, userId).length > 0;
    if (
      keeper &&
      active &&
      active.id !== keeper.id &&
      classifyOwnedKind(active, userId, hasMembership) === "personal"
    ) {
      setActiveArtistIdState(keeper.id);
      writeStoredArtistId(userId, keeper.id);
    }
  }, [artists, activeArtistId, user?.id]);

  const setActiveArtistId = React.useCallback(
    (id: string) => {
      explicitDemoActiveRef.current = Boolean(
        artists.find((artist) => artist.id === id)?.demo_kind
      );
      setActiveArtistIdState(id);
      writeStoredArtistId(user?.id ?? null, id);
    },
    [artists, user?.id]
  );

  const preferDemoId = hydrated ? readPreferDemoArtistId() : null;
  const preferOriginId = hydrated ? readPreferOriginArtistId() : null;
  const resolvedArtistId =
    preferDemoId && artists.some((a) => a.id === preferDemoId && a.demo_kind)
      ? preferDemoId
      : preferOriginId && artists.some((a) => a.id === preferOriginId)
      ? preferOriginId
      : activeArtistId;
  const activeArtist =
    artists.find((a) => a.id === resolvedArtistId) ?? artists[0] ?? null;

  const value: ActiveArtistContextValue = {
    artists,
    activeArtist,
    activeArtistId: activeArtist?.id ?? null,
    setActiveArtistId,
    isLoading: !hydrated || user === undefined || (!!user?.id && artistsQuery.isPending),
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
    onSettled: (_data, _error, variables) => {
      void invalidate();
      if (variables.artist.workspace_kind === "personal") {
        void qc.invalidateQueries({ queryKey: ["my-member-profile"] });
      }
    },
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
    onSettled: (_data, _error, artist) => {
      void invalidate();
      if (artist.workspace_kind === "personal") {
        void qc.invalidateQueries({ queryKey: ["my-member-profile"] });
      }
    },
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
