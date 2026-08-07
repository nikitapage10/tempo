"use client";

import * as React from "react";
import { Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSceneFeedMutations } from "@/hooks/use-scene-feed";
import type { ScenePostKind, SceneTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SceneComposer({
  sceneId,
  myProfileId,
  topics,
  activeTopicId,
  isManager,
  className,
}: {
  sceneId: string;
  myProfileId: string | null;
  topics: SceneTopic[];
  /** The topic currently being viewed — pre-selects the composer's topic. */
  activeTopicId: string | null;
  isManager: boolean;
  className?: string;
}) {
  const { create } = useSceneFeedMutations(sceneId, myProfileId);
  const [body, setBody] = React.useState("");
  const [topicId, setTopicId] = React.useState<string | null>(activeTopicId);
  const [announcement, setAnnouncement] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTopicId(activeTopicId);
  }, [activeTopicId]);

  const selectedTopic = topics.find((t) => t.id === topicId) ?? null;
  const postingBlocked =
    !!selectedTopic && selectedTopic.post_policy === "moderators" && !isManager;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myProfileId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const kind: ScenePostKind = announcement ? "announcement" : "post";
      await create.mutateAsync({ topicId, body: trimmed, kind });
      setBody("");
      setAnnouncement(false);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post — try again.");
    }
  }

  if (!myProfileId) return null;

  if (postingBlocked) {
    return (
      <div className={cn("panel-quiet p-4 text-sm text-text-lo", className)}>
        Only owners and moderators can post in {selectedTopic?.name}.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "panel space-y-3 transition-[padding] duration-150",
        expanded ? "p-4" : "p-2.5",
        className
      )}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Share something with the scene…"
        maxLength={5000}
        rows={expanded ? 3 : 1}
        className={cn(
          "resize-y transition-[min-height] duration-150",
          expanded ? "min-h-[4.5rem]" : "min-h-0 resize-none py-1.5"
        )}
      />
      {expanded ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {topics.length > 1 ? (
              <select
                value={topicId ?? ""}
                onChange={(e) => setTopicId(e.target.value || null)}
                className="rounded-input border border-line bg-bg-2 px-2 py-1.5 text-xs text-text-hi"
              >
                <option value="">All topics</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
            {isManager ? (
              <Button
                type="button"
                size="sm"
                variant={announcement ? "default" : "ghost"}
                onClick={() => setAnnouncement((v) => !v)}
              >
                <Megaphone className="size-3.5" />
                Announcement
              </Button>
            ) : null}
            <div className="flex-1" />
            {!body.trim() ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={create.isPending}>
              <Send className="size-3.5" />
              Post
            </Button>
          </div>
          {error ? <p className="text-xs text-warn">{error}</p> : null}
        </>
      ) : null}
    </form>
  );
}
