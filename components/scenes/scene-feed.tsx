"use client";

import * as React from "react";
import { Hash } from "lucide-react";
import { useSceneTopics } from "@/hooks/use-scene-topics";
import { useSceneFeed, useScenePinnedPosts } from "@/hooks/use-scene-feed";
import { SceneComposer } from "@/components/scenes/scene-composer";
import { ScenePostRow } from "@/components/scenes/scene-post-row";
import { PostDetailDialog } from "@/components/social/post-detail";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function SceneFeed({
  sceneId,
  myProfileId,
  isManager,
}: {
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
}) {
  const qc = useQueryClient();
  const { data: topics = [] } = useSceneTopics(sceneId);
  const [topicId, setTopicId] = React.useState<string | null>(null);
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);

  const { data: pinned = [] } = useScenePinnedPosts(sceneId, myProfileId);
  const { data: feed = [], isLoading } = useSceneFeed(sceneId, topicId, myProfileId);

  const visiblePinned = topicId
    ? pinned.filter((p) => p.scene_topic_id === topicId)
    : pinned;

  return (
    <div className="grid gap-4 lg:grid-cols-[10rem_minmax(0,1fr)]">
      {topics.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
          <button
            type="button"
            onClick={() => setTopicId(null)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-left text-xs lg:rounded-input",
              !topicId ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo hover:text-text-hi"
            )}
          >
            All
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopicId(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-chip border px-3 py-1.5 text-left text-xs lg:rounded-input",
                topicId === t.id
                  ? "border-ice/40 bg-ice/10 text-ice"
                  : "border-line text-text-lo hover:text-text-hi"
              )}
            >
              <Hash className="size-3" />
              {t.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-w-0 space-y-3">
        <SceneComposer
          sceneId={sceneId}
          myProfileId={myProfileId}
          topics={topics}
          activeTopicId={topicId}
          isManager={isManager}
        />

        {visiblePinned.map((post) => (
          <ScenePostRow
            key={post.id}
            post={post}
            sceneId={sceneId}
            myProfileId={myProfileId}
            isManager={isManager}
            onOpen={() => setOpenPostId(post.id)}
          />
        ))}

        {isLoading ? (
          <div className="panel-quiet h-24 animate-pulse" />
        ) : feed.length === 0 && visiblePinned.length === 0 ? (
          <p className="py-4 text-sm text-text-lo">
            Nobody&rsquo;s posted yet — be the first.
          </p>
        ) : (
          feed.map((post) => (
            <ScenePostRow
              key={post.id}
              post={post}
              sceneId={sceneId}
              myProfileId={myProfileId}
              isManager={isManager}
              onOpen={() => setOpenPostId(post.id)}
            />
          ))
        )}
      </div>

      <PostDetailDialog
        postId={openPostId}
        myProfileId={myProfileId}
        open={!!openPostId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenPostId(null);
            void qc.invalidateQueries({ queryKey: ["scene-feed", sceneId] });
          }
        }}
      />
    </div>
  );
}
