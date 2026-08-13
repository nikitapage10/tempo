"use client";

import * as React from "react";
import { PrismShard } from "@/components/gamification/prism-shard";
import { QuietEmpty } from "@/components/ui/section-header";
import { useAchievementAwards, useMarkAchievementsSeen } from "@/hooks/use-achievements";
import { ACHIEVEMENTS, achievementByKey } from "@/lib/gamification/achievements";
import { GRADE_ORDER } from "@/lib/gamification/grades";
import { cn } from "@/lib/utils";

/**
 * The full trophy shelf. Earned achievements show their real name and
 * flavor; unearned ones show only their grade's colour and a locked outline
 * — Umbra-grade entries specifically never reveal their name until awarded,
 * which is the point of that grade.
 */
export function AchievementList({ artistId }: { artistId: string }) {
  const { data: awards } = useAchievementAwards(artistId);
  const markSeen = useMarkAchievementsSeen(artistId);

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

  const grouped = GRADE_ORDER.map((grade) => ({
    grade,
    defs: ACHIEVEMENTS.filter((d) => d.grade === grade),
  }));

  const earnedCount = awards.length;

  return (
    <div className="space-y-5">
      <p className="text-xs text-text-lo">
        {earnedCount} of {ACHIEVEMENTS.length} unlocked.
      </p>

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

      {ACHIEVEMENTS.length === 0 ? (
        <QuietEmpty>Nothing here yet.</QuietEmpty>
      ) : null}
    </div>
  );
}

export { achievementByKey };
