"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useActiveSpace } from "@/components/active-space-provider";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { formatHours, type SpaceSummary } from "@/lib/artist-stats";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Per-space breakdown inside the artist.
 *
 * Spaces are the artist's working rooms, and every other screen shows exactly
 * one of them — this is the only place they can be compared. A music space
 * reports tracks/bounces/focus; a tasks space reports tasks/projects, since
 * it has neither board nor bounces.
 */
export function SpacesOverview({ spaces }: { spaces: SpaceSummary[] }) {
  const router = useRouter();
  const { activeSpaceId, setActiveSpaceId } = useActiveSpace();

  if (spaces.length === 0) {
    return (
      <p className="text-sm text-text-lo">
        This artist has no spaces yet. Add one in Settings.
      </p>
    );
  }

  function open(summary: SpaceSummary) {
    setActiveSpaceId(summary.space.id);
    router.push(summary.space.focus === "tasks" ? "/tasks" : "/board");
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {spaces.map((summary) => {
        const tasksFocused = summary.space.focus === "tasks";
        const isActive = summary.space.id === activeSpaceId;
        return (
          <SpotlightCard
            as="li"
            key={summary.space.id}
            radius={12}
            size={240}
            className={cn(
              "well lift p-4",
              isActive && "border-ice/25"
            )}
          >
            <button
              type="button"
              onClick={() => open(summary)}
              className="group w-full text-left focus-visible:outline-none"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-text-hi">
                  {summary.space.name}
                </span>
                {isActive ? (
                  <span className="label-mono text-ice">Active</span>
                ) : null}
                <ArrowRight className="size-3.5 shrink-0 text-text-lo opacity-0 transition-opacity duration-hover group-hover:opacity-100" />
              </div>

              <p className="mt-0.5 text-xs text-text-lo">
                {tasksFocused ? "Tasks & projects" : "Music"}
                {summary.topStageName && !tasksFocused
                  ? ` · mostly ${summary.topStageName}`
                  : ""}
              </p>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {tasksFocused ? (
                  <>
                    <SpaceStat label="Open tasks" value={summary.openTasks} />
                    <SpaceStat label="Projects" value={summary.projectCount} />
                  </>
                ) : (
                  <>
                    <SpaceStat label="Tracks" value={summary.trackCount} />
                    <SpaceStat label="Active" value={summary.activeCount} />
                    <SpaceStat label="Bounces" value={summary.bounceCount} />
                    <SpaceStat
                      label="Focus"
                      display={
                        summary.focusSec > 0 ? formatHours(summary.focusSec) : "—"
                      }
                    />
                  </>
                )}
              </dl>

              <p className="mt-3 text-xs text-text-lo">
                {summary.lastActivityAt
                  ? `Last touched ${formatShortDate(summary.lastActivityAt)}`
                  : "Nothing in here yet"}
              </p>
            </button>
          </SpotlightCard>
        );
      })}
    </ul>
  );
}

function SpaceStat({
  label,
  value,
  display,
}: {
  label: string;
  value?: number;
  display?: string;
}) {
  const shown = display ?? String(value ?? 0);
  const muted = display ? display === "—" : !value;
  return (
    <div>
      <dd
        className={cn(
          "text-[15px] tabular-nums",
          muted ? "text-text-lo/50" : "text-text-hi"
        )}
      >
        {shown}
      </dd>
      <dt className="label-mono mt-1">{label}</dt>
    </div>
  );
}
