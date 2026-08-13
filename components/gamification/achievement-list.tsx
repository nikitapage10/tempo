"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { PrismShard } from "@/components/gamification/prism-shard";
import { QuietEmpty } from "@/components/ui/section-header";
import { useAchievementAwards, useMarkAchievementsSeen } from "@/hooks/use-achievements";
import { ACHIEVEMENTS, achievementByKey } from "@/lib/gamification/achievements";
import { GRADE_ORDER } from "@/lib/gamification/grades";
import { cn } from "@/lib/utils";

/**
 * Defaults to a shelf of what's actually been earned — dumping all ~100
 * definitions (most of them locked) below the fold on every load made the
 * page scroll forever for no reason. "Show the full catalog" expands into
 * the grade-grouped view with locked entries greyed and Umbra names hidden
 * until earned; collapsing scrolls back to the shelf.
 */
export function AchievementList({ artistId }: { artistId: string }) {
  const { data: awards } = useAchievementAwards(artistId);
  const markSeen = useMarkAchievementsSeen(artistId);
  const [showAll, setShowAll] = React.useState(false);

  const awardedByKey = React.useMemo(
    () => new Map((awards ?? []).map((a) => [a.achievementKey, a])),
    [awards]
  );

  React.useEffect(() => {
    const unseen = (awards ?? []).filter((a) => !a.seenAt).map((a) => a.id);
    if (unseen.length > 0) markSeen.mutate(unseen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awards]);

  if (!awards) return null;

  const earned = [...awards].sort(
    (a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime()
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-lo">
          {earned.length} of {ACHIEVEMENTS.length} unlocked.
        </p>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1 rounded-input px-1.5 py-0.5 text-xs text-text-lo transition-colors duration-hover hover:text-ice"
          aria-expanded={showAll}
        >
          {showAll ? "Show just what's unlocked" : "Show full catalog"}
          <ChevronDown className={cn("size-3 transition-transform duration-hover", showAll && "rotate-180")} />
        </button>
      </div>

      {showAll ? (
        <FullCatalog awardedByKey={awardedByKey} />
      ) : earned.length === 0 ? (
        <QuietEmpty>
          Nothing unlocked yet. Real work — a finished track, a show logged, a few
          consistent weeks — earns these, not tapping around the page.
        </QuietEmpty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {earned.slice(0, 8).map((award) => {
            const def = achievementByKey(award.achievementKey);
            if (!def) return null;
            return (
              <li key={award.id} className="well flex items-start gap-2.5 rounded-input p-2.5">
                <PrismShard grade={def.grade} earned size={30} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-text-hi">{def.name}</p>
                  <p className="mt-0.5 text-[11px] text-text-lo">{def.flavor}</p>
                  <p className="mt-0.5 text-[10px] text-text-lo/70">
                    {new Date(award.awardedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FullCatalog({
  awardedByKey,
}: {
  awardedByKey: Map<string, { awardedAt: string }>;
}) {
  const grouped = GRADE_ORDER.map((grade) => ({
    grade,
    defs: ACHIEVEMENTS.filter((d) => d.grade === grade),
  }));

  return (
    <div className="max-h-[28rem] space-y-5 overflow-y-auto pr-1">
      {grouped.map(({ grade, defs }) => (
        <div key={grade}>
          <p className="label-mono mb-2 capitalize">{grade}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {defs.map((def) => {
              const award = awardedByKey.get(def.key);
              const earned = !!award;
              const hideDetails = def.grade === "umbra" && !earned;
              return (
                <li
                  key={def.key}
                  className={cn(
                    "well flex items-start gap-2.5 rounded-input p-2.5",
                    !earned && "opacity-60"
                  )}
                >
                  <PrismShard grade={def.grade} earned={earned} size={30} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-hi">
                      {hideDetails ? "???" : def.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-lo">
                      {hideDetails ? "Hidden until earned." : def.flavor}
                    </p>
                    {award ? (
                      <p className="mt-0.5 text-[10px] text-text-lo/70">
                        {new Date(award.awardedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export { achievementByKey };
