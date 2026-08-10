"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronRight } from "lucide-react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { LfWindow } from "@/components/lf-windows";
import type { Stage } from "@/lib/types";
import { stageHueAt, stageProgressFromSort } from "@/lib/stage-hue";
import { cn } from "@/lib/utils";

export function StageRail({ stage, stages, itemCount, isOver, onOpen }: {
  stage: Stage;
  stages: Stage[];
  itemCount: number;
  isOver: boolean;
  onOpen: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage.id, data: { stage } });
  const hues = useActiveArtistPalette();
  const hue = stageHueAt(stageProgressFromSort(stage.sort, stages), hues);

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex min-h-12 w-full shrink-0 items-center gap-3 overflow-hidden rounded-panel border border-line bg-gradient-to-b from-[#141419] to-[#0e0e12] px-3 text-left shadow-e1 transition-[width,border-color,box-shadow] duration-300",
        "lg:min-h-[220px] lg:w-12 lg:flex-col lg:px-0 lg:py-3",
        "hover:border-white/15 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
        isOver && "border-ice/50 bg-ice/[0.05] glow-ice"
      )}
      aria-label={`Open ${stage.name}, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-70" style={{ background: `linear-gradient(180deg, ${hue}18, transparent)` }} />
      <LfWindow className="relative hidden h-[2px] w-4 shrink-0 overflow-hidden rounded-full lg:block">
        <span className="absolute inset-0 opacity-75" style={{ backgroundColor: hue }} />
      </LfWindow>
      <span className="relative order-2 min-w-0 flex-1 truncate font-display text-xs font-medium text-text-lo group-hover:text-text-hi lg:order-3 lg:flex-none lg:[text-orientation:mixed] lg:[writing-mode:vertical-rl]">
        {stage.name}
      </span>
      <span className="relative order-1 rounded-chip bg-bg-3 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-mid lg:order-2">
        {itemCount}
      </span>
      <ChevronRight className="relative order-3 ml-auto size-3.5 text-text-lo/50 group-hover:text-ice lg:mt-auto lg:ml-0 lg:rotate-90" />
    </button>
  );
}
