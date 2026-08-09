"use client";

import * as React from "react";
import { Megaphone, MessageCircleQuestion, Plus, Send, SquarePen, Trash2, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSceneFeedMutations } from "@/hooks/use-scene-feed";
import { useScenePollMutations } from "@/hooks/use-scene-polls";
import type { ScenePostKind, SceneTopic } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

type ComposerKind = Exclude<ScenePostKind, "announcement"> | "announcement";

const MAX_OPTIONS = 10;

export function SceneComposer({
  sceneId,
  myProfileId,
  topics,
  activeTopicId,
  sectionId = null,
  isManager,
  className,
}: {
  sceneId: string;
  myProfileId: string | null;
  topics: SceneTopic[];
  /** The topic currently being viewed — pre-selects the composer's topic. */
  activeTopicId: string | null;
  sectionId?: string | null;
  isManager: boolean;
  className?: string;
}) {
  const { create } = useSceneFeedMutations(sceneId, myProfileId, sectionId);
  const { createPoll, createQuestion } = useScenePollMutations(sceneId);
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState<ComposerKind>("post");
  const [options, setOptions] = React.useState<string[]>(["", ""]);
  const [multiChoice, setMultiChoice] = React.useState(false);
  const [topicId, setTopicId] = React.useState<string | null>(activeTopicId);
  const [expanded, setExpanded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTopicId(activeTopicId);
  }, [activeTopicId]);

  const selectedTopic = topics.find((t) => t.id === topicId) ?? null;
  const postingBlocked =
    !!selectedTopic && selectedTopic.post_policy === "moderators" && !isManager;
  const busy = create.isPending || createPoll.isPending || createQuestion.isPending;

  function resetForm() {
    setBody("");
    setKind("post");
    setOptions(["", ""]);
    setMultiChoice(false);
    setExpanded(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myProfileId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      if (kind === "poll") {
        await createPoll.mutateAsync({
          authorProfileId: myProfileId,
          topicId,
          question: trimmed,
          options,
          multiChoice,
        });
      } else if (kind === "question") {
        await createQuestion.mutateAsync({
          authorProfileId: myProfileId,
          topicId,
          question: trimmed,
        });
      } else {
        await create.mutateAsync({ topicId, body: trimmed, kind });
      }
      resetForm();
    } catch (err) {
      setError(errorMessage(err, "Couldn't post — try again."));
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
        "panel space-y-3 transition-[padding,border-color] duration-150",
        expanded ? "p-4" : "cursor-text p-2.5 hover:border-ice/30",
        className
      )}
      onClick={() => {
        if (!expanded) document.getElementById("scene-composer-input")?.focus();
      }}
    >
      <div className={cn("flex items-center", expanded ? "" : "gap-2")}>
        {!expanded ? <SquarePen className="size-4 shrink-0 text-text-lo" /> : null}
        <Textarea
          id="scene-composer-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder={
            kind === "poll"
              ? "Ask a question with a few answers…"
              : kind === "question"
                ? "Ask an open question…"
                : "Share something with the scene…"
          }
          maxLength={5000}
          rows={expanded ? 3 : 1}
          className={cn(
            "resize-y transition-[min-height] duration-150",
            expanded
              ? "min-h-[4.5rem]"
              : "min-h-0 resize-none border-transparent bg-transparent py-1.5 placeholder:text-text-lo"
          )}
        />
      </div>

      {expanded ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={kind === "post" ? "default" : "ghost"}
              onClick={() => setKind("post")}
            >
              Post
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "question" ? "default" : "ghost"}
              onClick={() => setKind("question")}
            >
              <MessageCircleQuestion className="size-3.5" />
              Question
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "poll" ? "default" : "ghost"}
              onClick={() => setKind("poll")}
            >
              <Vote className="size-3.5" />
              Poll
            </Button>
            {isManager ? (
              <Button
                type="button"
                size="sm"
                variant={kind === "announcement" ? "default" : "ghost"}
                onClick={() => setKind("announcement")}
              >
                <Megaphone className="size-3.5" />
                Announcement
              </Button>
            ) : null}
          </div>

          {kind === "poll" ? (
            <div className="well space-y-2 rounded-input p-3">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    maxLength={120}
                  />
                  {options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-warn"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
              <div className="flex items-center justify-between">
                {options.length < MAX_OPTIONS ? (
                  <button
                    type="button"
                    onClick={() => setOptions([...options, ""])}
                    className="flex items-center gap-1 text-xs text-ice hover:underline"
                  >
                    <Plus className="size-3" />
                    Add option
                  </button>
                ) : (
                  <span />
                )}
                <label className="flex items-center gap-1.5 text-xs text-text-lo">
                  <input
                    type="checkbox"
                    checked={multiChoice}
                    onChange={(e) => setMultiChoice(e.target.checked)}
                    className="rounded-sm"
                  />
                  Allow more than one answer
                </label>
              </div>
            </div>
          ) : null}

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
            <div className="flex-1" />
            {!body.trim() ? (
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={busy}>
              <Send className="size-3.5" />
              {kind === "poll" ? "Post poll" : kind === "question" ? "Ask" : "Post"}
            </Button>
          </div>
          {error ? <p className="text-xs text-warn">{error}</p> : null}
        </>
      ) : null}
    </form>
  );
}
