"use client";

import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistMembership } from "@/hooks/use-artist-membership";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  resolveWorkspaceMode,
  socialAuthorArtistId,
  type WorkspaceMode,
} from "@/lib/workspace-mode";
import type { AreaGrants } from "@/lib/team/areas";
import type { MemberRole } from "@/lib/team/roles";
import type { Artist } from "@/lib/types";

export function useWorkspaceMode(): {
  mode: WorkspaceMode;
  isOwner: boolean;
  areas: AreaGrants;
  role: MemberRole | null;
  isLoading: boolean;
  activeArtist: Artist | null;
  artists: Artist[];
  socialArtistId: string | null;
} {
  const { activeArtist, artists, isLoading: artistLoading } = useActiveArtist();
  const user = useCurrentUser();
  const membership = useArtistMembership(activeArtist);
  const mode = resolveWorkspaceMode(activeArtist, user?.id, artists);
  return {
    mode,
    isOwner: membership.isOwner,
    areas: membership.areas,
    role: membership.role,
    isLoading: artistLoading || membership.isLoading || user === undefined,
    activeArtist,
    artists,
    socialArtistId: socialAuthorArtistId(artists, activeArtist, user?.id),
  };
}
