"use client";

import { Suspense } from "react";
import { BoardView } from "@/components/board/board-view";

export default function BoardPage() {
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
      <BoardView />
    </Suspense>
  );
}
