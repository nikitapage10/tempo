"use client";

import * as React from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollowMutations, useIsFollowing } from "@/hooks/use-follows";

export function FollowButton({
  myProfileId,
  targetProfileId,
  className,
}: {
  myProfileId: string | null;
  targetProfileId: string;
  className?: string;
}) {
  const { data: following = false, isLoading } = useIsFollowing(
    myProfileId,
    targetProfileId
  );
  const { follow, unfollow } = useFollowMutations(myProfileId);
  const busy = follow.isPending || unfollow.isPending;
  const isSelf = !!myProfileId && myProfileId === targetProfileId;

  if (!myProfileId || isSelf) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "default"}
      className={className}
      disabled={busy || isLoading}
      onClick={() => {
        if (following) unfollow.mutate(targetProfileId);
        else follow.mutate(targetProfileId);
      }}
    >
      {following ? (
        <>
          <UserMinus className="size-3.5" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="size-3.5" />
          Follow
        </>
      )}
    </Button>
  );
}
