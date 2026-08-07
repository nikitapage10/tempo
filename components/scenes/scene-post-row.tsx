"use client";

import * as React from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { FeedPostCard } from "@/components/social/feed-post";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSceneFeedMutations } from "@/hooks/use-scene-feed";
import type { Post } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  announcement: "Announcement",
  poll: "Poll",
  question: "Question",
};

export function ScenePostRow({
  post,
  sceneId,
  myProfileId,
  isManager,
  onOpen,
}: {
  post: Post;
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
  onOpen: () => void;
}) {
  const { like, unlike, pin, remove } = useSceneFeedMutations(sceneId, myProfileId);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const kindLabel = post.kind && post.kind !== "post" ? KIND_LABEL[post.kind] : null;

  return (
    <div className="space-y-1.5">
      {kindLabel || post.pinned_at ? (
        <div className="flex items-center gap-2 px-1 text-[11px] text-text-lo">
          {post.pinned_at ? (
            <span className="flex items-center gap-1 text-amber">
              <Pin className="size-3" />
              Pinned
            </span>
          ) : null}
          {kindLabel ? <span>{kindLabel}</span> : null}
        </div>
      ) : null}
      <div className="relative">
        <FeedPostCard
          post={post}
          onLike={() => like.mutate(post.id)}
          onUnlike={() => unlike.mutate(post.id)}
          onOpen={onOpen}
          myProfileId={myProfileId}
        />
        {isManager ? (
          <div className="absolute right-3 top-3 flex items-center gap-1">
            <button
              type="button"
              title={post.pinned_at ? "Unpin" : "Pin"}
              onClick={() => pin.mutate({ postId: post.id, pinned: !post.pinned_at })}
              className="rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-ice"
            >
              {post.pinned_at ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
            <button
              type="button"
              title="Remove"
              onClick={() => setConfirmRemove(true)}
              className="rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-warn"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this post?"
        description="It stays out of the feed for everyone. This is logged in the moderation history."
        confirmLabel="Remove post"
        busy={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync({ postId: post.id });
          setConfirmRemove(false);
        }}
      />
    </div>
  );
}
