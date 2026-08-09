"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Hash } from "lucide-react";
import { useSceneTopics } from "@/hooks/use-scene-topics";
import { useSceneFeed, useScenePinnedPosts } from "@/hooks/use-scene-feed";
import { useScenePollsForPosts } from "@/hooks/use-scene-polls";
import { SceneComposer } from "@/components/scenes/scene-composer";
import { ScenePostRow } from "@/components/scenes/scene-post-row";
import { PostDetailDialog } from "@/components/social/post-detail";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSceneSections } from "@/hooks/use-scene-v2";

export function SceneFeed({
  sceneId,
  myProfileId,
  isManager,
}: {
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
}) {
  const searchParams = useSearchParams();
  const { data: sections = [] } = useSceneSections(sceneId);
  const sectionId = sections.find((section) => section.slug === searchParams.get("section") && section.type === "discussion")?.id ?? null;
  const qc = useQueryClient();
  const { data: topics = [] } = useSceneTopics(sceneId);
  const [topicId, setTopicId] = React.useState<string | null>(null);
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);

  const { data: pinned = [] } = useScenePinnedPosts(sceneId, myProfileId);
  const { data: feed = [], isLoading } = useSceneFeed(sceneId, topicId, myProfileId, sectionId);

  const sectionPinned = sectionId ? pinned.filter((post) => post.scene_section_id === sectionId) : pinned;
  const visiblePinned = topicId ? sectionPinned.filter((post) => post.scene_topic_id === topicId) : sectionPinned;

  const pollPostIds = React.useMemo(
    () =>
      [...visiblePinned, ...feed].filter((p) => p.kind === "poll").map((p) => p.id),
    [visiblePinned, feed]
  );
  const { data: polls } = useScenePollsForPosts(pollPostIds, myProfileId);

  return (
    <div className={cn("gap-4", topics.length > 1 && "grid lg:grid-cols-[10rem_minmax(0,1fr)]")}>
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
          sectionId={sectionId}
          isManager={isManager}
        />

        {visiblePinned.map((post) => (
          <ScenePostRow
            key={post.id}
            post={post}
            poll={polls?.get(post.id)}
            sceneId={sceneId}
            myProfileId={myProfileId}
            isManager={isManager}
            onOpen={() => setOpenPostId(post.id)}
          />
        ))}

        {isLoading ? (
          <div className="panel-quiet h-24 animate-pulse" />
        ) : feed.length === 0 && visiblePinned.length === 0 ? (
          <EmptyShaderPanel
            className="h-[220px]"
            title="Nobody's posted yet"
            copy="Be the first to share something with the scene."
            action={
              myProfileId ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => document.getElementById("scene-composer-input")?.focus()}
                >
                  Start the conversation
                </Button>
              ) : undefined
            }
          />
        ) : (
          feed.map((post) => (
            <ScenePostRow
              key={post.id}
              post={post}
              poll={polls?.get(post.id)}
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
