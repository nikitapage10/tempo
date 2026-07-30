"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFollowers,
  fetchFollowing,
  followProfile,
  isFollowingProfile,
  unfollowProfile,
} from "@/lib/api/follows";

export function useFollowing(profileId: string | null) {
  return useQuery({
    queryKey: ["following", profileId],
    queryFn: () => fetchFollowing(profileId!),
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export function useFollowers(profileId: string | null) {
  return useQuery({
    queryKey: ["followers", profileId],
    queryFn: () => fetchFollowers(profileId!),
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export function useIsFollowing(
  myProfileId: string | null,
  targetProfileId: string | null
) {
  return useQuery({
    queryKey: ["is-following", myProfileId, targetProfileId],
    queryFn: () => isFollowingProfile(myProfileId!, targetProfileId!),
    enabled: !!myProfileId && !!targetProfileId && myProfileId !== targetProfileId,
    staleTime: 10_000,
  });
}

export function useFollowMutations(myProfileId: string | null) {
  const qc = useQueryClient();
  const invalidate = (targetId: string) => {
    qc.invalidateQueries({ queryKey: ["following", myProfileId] });
    qc.invalidateQueries({ queryKey: ["followers", targetId] });
    qc.invalidateQueries({ queryKey: ["is-following", myProfileId, targetId] });
    qc.invalidateQueries({ queryKey: ["home-timeline"] });
  };

  const follow = useMutation({
    mutationFn: (targetProfileId: string) =>
      followProfile(myProfileId!, targetProfileId),
    onSuccess: (_d, targetId) => invalidate(targetId),
  });

  const unfollow = useMutation({
    mutationFn: (targetProfileId: string) =>
      unfollowProfile(myProfileId!, targetProfileId),
    onSuccess: (_d, targetId) => invalidate(targetId),
  });

  return { follow, unfollow };
}
