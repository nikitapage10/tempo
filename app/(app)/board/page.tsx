"use client";

import { Suspense } from "react";
import { BoardView } from "@/components/board/board-view";
import { ProWorkflowBoard } from "@/components/board/pro-workflow-board";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";

export default function BoardPage() {
  const { mode, isLoading } = useWorkspaceMode();

  return (
    <Suspense
      fallback={
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 w-[280px] shrink-0 animate-pulse rounded-card border border-line bg-bg-1"
            />
          ))}
        </div>
      }
    >
      {isLoading ? null : mode === "work" ? <ProWorkflowBoard /> : <BoardView />}
    </Suspense>
  );
}
