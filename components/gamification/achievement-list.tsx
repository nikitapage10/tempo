"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { PrismShard, useGradeStyles } from "@/components/gamification/prism-shard";
import { QuietEmpty } from "@/components/ui/section-header";
import { useAchievementAwards, useMarkAchievementsSeen } from "@/hooks/use-achievements";
import {
  ACHIEVEMENTS,
  achievementByKey,
  type AchievementDef,
} from "@/lib/gamification/achievements";
import { GRADE_ORDER } from "@/lib/gamification/grades";
import { cn } from "@/lib/utils";

/**
 * Defaults to a shelf of everything actually earned — the count at the top
 * is the list you can scroll. "Show the full catalog" expands into the
 * grade-grouped view: earned tiles stay lit on the flare, locked ones are
 * dashed and unlit, Umbra names stay hidden until earned.
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

  const earned = [...awards]
    .filter((a) => achievementByKey(a.achievementKey))
    .sort(
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
        <ul className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {earned.map((award) => {
            const def = achievementByKey(award.achievementKey);
            if (!def) return null;
            return (
              <AchievementTile
                key={award.id}
                def={def}
                earned
                awardedAt={award.awardedAt}
              />
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
              return (
                <AchievementTile
                  key={def.key}
                  def={def}
                  earned={!!award}
                  awardedAt={award?.awardedAt}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AchievementTile({
  def,
  earned,
  awardedAt,
}: {
  def: AchievementDef;
  earned: boolean;
  awardedAt?: string;
}) {
  const styles = useGradeStyles();
  const style = styles[def.grade];
  const hideDetails = def.grade === "umbra" && !earned;

  return (
    <li className={cn("achievement-tile", earned ? "achievement-tile-earned" : "achievement-tile-locked")}>
      <PrismShard grade={def.grade} earned={earned} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs font-medium",
              earned ? "text-text-hi" : "text-text-lo"
            )}
          >
            {hideDetails ? "???" : def.name}
          </p>
          <span
            className={cn(
              "label-mono shrink-0 text-[9px] uppercase tracking-[0.08em]",
              earned ? "opacity-90" : "text-text-lo/60"
            )}
            style={earned ? { color: style.color } : undefined}
          >
            {hideDetails ? "Umbra" : style.label}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 text-[11px] leading-snug",
            earned ? "text-text-lo" : "text-text-lo/65"
          )}
        >
          {hideDetails ? "Hidden until earned." : def.flavor}
        </p>
        {earned && awardedAt ? (
          <p className="mt-1 text-[10px] font-data" style={{ color: style.color }}>
            {new Date(awardedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export { achievementByKey };
