"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSpace,
  deleteSpace,
  ensureDefaultSpaces,
  renameSpace,
  reorderSpaces,
  updateSpaceFocus,
} from "@/lib/api/spaces";
import { ensureDefaultTemplates } from "@/lib/api/templates";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ACTIVE_SPACE_KEY } from "@/lib/constants";
import { artistWorkspaceKind } from "@/lib/workspace-mode";
import type { Space, SpaceFocus } from "@/lib/types";

type ActiveSpaceContextValue = {
  spaces: Space[];
  activeSpace: Space | null;
  activeSpaceId: string | null;
  setActiveSpaceId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const ActiveSpaceContext = React.createContext<ActiveSpaceContextValue | null>(
  null
);

function readStoredSpaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_SPACE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSpaceId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SPACE_KEY, id);
  } catch {
    /* ignore */
  }
}

async function bootstrapSpacesForArtist(
  artistId: string,
  kind: "artist" | "personal"
): Promise<Space[]> {
  const [spaces] = await Promise.all([
    ensureDefaultSpaces(artistId, kind),
    ensureDefaultTemplates(),
  ]);
  return spaces;
}

export function ActiveSpaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeSpaceId, setActiveSpaceIdState] = React.useState<string | null>(
    null
  );
  const [hydrated, setHydrated] = React.useState(false);
  const { activeArtist, activeArtistId, isLoading: artistLoading } = useActiveArtist();

  React.useEffect(() => {
    setActiveSpaceIdState(readStoredSpaceId());
    setHydrated(true);
  }, []);

  // Keyed by artist so switching artists refetches that artist's spaces; the
  // "still valid" effect below then re-resolves the active space for us.
  const spacesQuery = useQuery({
    queryKey: ["spaces", activeArtistId, artistWorkspaceKind(activeArtist)],
    queryFn: () =>
      bootstrapSpacesForArtist(
        activeArtistId!,
        artistWorkspaceKind(activeArtist)
      ),
    enabled: hydrated && !artistLoading && !!activeArtistId,
  });

  const spaces = React.useMemo(
    () => spacesQuery.data ?? [],
    [spacesQuery.data]
  );

  React.useEffect(() => {
    if (!spaces.length) return;
    const stillValid =
      activeSpaceId && spaces.some((s) => s.id === activeSpaceId);
    if (!stillValid) {
      const next = spaces[0].id;
      setActiveSpaceIdState(next);
      writeStoredSpaceId(next);
    }
  }, [spaces, activeSpaceId]);

  const setActiveSpaceId = React.useCallback((id: string) => {
    setActiveSpaceIdState(id);
    writeStoredSpaceId(id);
  }, []);

  const activeSpace =
    spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null;

  const value: ActiveSpaceContextValue = {
    spaces,
    activeSpace,
    activeSpaceId: activeSpace?.id ?? null,
    setActiveSpaceId,
    isLoading: !hydrated || artistLoading || spacesQuery.isLoading,
    isError: spacesQuery.isError,
    error: spacesQuery.error as Error | null,
  };

  return (
    <ActiveSpaceContext.Provider value={value}>
      {children}
    </ActiveSpaceContext.Provider>
  );
}

export function useActiveSpace() {
  const ctx = React.useContext(ActiveSpaceContext);
  if (!ctx) {
    throw new Error("useActiveSpace must be used within ActiveSpaceProvider");
  }
  return ctx;
}

export function useSpaceMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["spaces"] });

  // artistId stays explicit rather than read from context here, so a future UI
  // can create a space for a non-active artist.
  const create = useMutation({
    mutationFn: ({
      name,
      sort,
      artistId,
      focus,
    }: {
      name: string;
      sort: number;
      artistId: string;
      focus?: SpaceFocus;
    }) => createSpace(name, sort, artistId, focus),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameSpace(id, name),
    onSuccess: invalidate,
  });

  const updateFocus = useMutation({
    mutationFn: ({ id, focus }: { id: string; focus: SpaceFocus }) =>
      updateSpaceFocus(id, focus),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSpace(id),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (ordered: { id: string; sort: number }[]) =>
      reorderSpaces(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: ["spaces"] });
      const prev = qc.getQueryData<Space[]>(["spaces"]);
      if (prev) {
        const byId = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<Space[]>(
          ["spaces"],
          [...prev]
            .map((s) => ({ ...s, sort: byId.get(s.id) ?? s.sort }))
            .sort((a, b) => a.sort - b.sort)
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["spaces"], ctx.prev);
    },
    onSettled: invalidate,
  });

  return { create, rename, remove, reorder, updateFocus };
}
