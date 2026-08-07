"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { useScenePollMutations } from "@/hooks/use-scene-polls";
import { Button } from "@/components/ui/button";
import type { ScenePoll } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PollCard({
  poll,
  sceneId,
  myProfileId,
  isManager,
}: {
  poll: ScenePoll;
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
}) {
  const { vote, close } = useScenePollMutations(sceneId);
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const options = poll.options ?? [];
  const myVotes = new Set(poll.my_option_ids ?? []);
  const hasVoted = myVotes.size > 0;
  const closed = !!poll.closed_at || (!!poll.closes_at && new Date(poll.closes_at) <= new Date());
  const showResults = hasVoted || closed;

  async function toggleOption(optionId: string) {
    if (!myProfileId || closed) return;
    const next = poll.multi_choice
      ? myVotes.has(optionId)
        ? Array.from(myVotes).filter((id) => id !== optionId)
        : Array.from(myVotes).concat(optionId)
      : [optionId];
    setPending(new Set(next));
    try {
      await vote.mutateAsync({ pollId: poll.id, optionIds: next, profileId: myProfileId });
    } finally {
      setPending(new Set());
    }
  }

  return (
    <div className="well mt-3 space-y-2 rounded-input p-3">
      {options.map((opt) => {
        const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
        const mine = myVotes.has(opt.id);
        const isPending = pending.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            disabled={closed || vote.isPending}
            onClick={() => void toggleOption(opt.id)}
            className={cn(
              "relative w-full overflow-hidden rounded-input border px-3 py-2 text-left text-sm transition-colors",
              mine ? "border-ice/50" : "border-line",
              closed ? "cursor-default" : "hover:border-ice/40"
            )}
          >
            {showResults ? (
              <span
                className="absolute inset-y-0 left-0 bg-ice/10"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            ) : null}
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-text-hi">
                {mine ? <Check className={cn("size-3.5 text-ice", isPending && "animate-pulse")} /> : null}
                {opt.label}
              </span>
              {showResults ? (
                <span className="shrink-0 text-xs text-text-lo">
                  {pct}% · {opt.vote_count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      <div className="flex items-center justify-between text-xs text-text-lo">
        <span>
          {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
          {closed ? " · closed" : ""}
        </span>
        {isManager && !closed ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            disabled={close.isPending}
            onClick={() => close.mutate(poll.id)}
          >
            <Lock className="size-3" />
            Close poll
          </Button>
        ) : null}
      </div>
    </div>
  );
}
