"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const CONTENT_SWAP_MS = 130;

/**
 * Lets the grid begin resizing before a stage swaps between its detailed
 * column and compact rail. Keeping the swap between the two fades prevents
 * dense card content from visibly reflowing through a 48px-wide stage.
 */
export function BoardStageSlot({
  expanded,
  expandedContent,
  railContent,
}: {
  expanded: boolean;
  expandedContent: React.ReactNode;
  railContent: React.ReactNode;
}) {
  const [showExpanded, setShowExpanded] = React.useState(expanded);
  const [contentVisible, setContentVisible] = React.useState(true);
  const shownExpandedRef = React.useRef(expanded);

  React.useEffect(() => {
    if (expanded === shownExpandedRef.current) {
      setContentVisible(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownExpandedRef.current = expanded;
      setShowExpanded(expanded);
      setContentVisible(true);
      return;
    }

    setContentVisible(false);
    let revealFrame = 0;
    let settleFrame = 0;
    const swapTimer = window.setTimeout(() => {
      shownExpandedRef.current = expanded;
      setShowExpanded(expanded);
      revealFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          setContentVisible(true);
        });
      });
    }, CONTENT_SWAP_MS);

    return () => {
      window.clearTimeout(swapTimer);
      window.cancelAnimationFrame(revealFrame);
      window.cancelAnimationFrame(settleFrame);
    };
  }, [expanded]);

  return (
    <div className="min-w-0 overflow-hidden lg:h-full">
      <div
        className={cn(
          "h-full origin-center transition-[opacity,transform] duration-200 ease-out will-change-[opacity,transform] lg:[&>*]:h-full",
          contentVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-0.5 scale-[0.992] opacity-0",
          "motion-reduce:transform-none motion-reduce:transition-none"
        )}
      >
        {showExpanded ? expandedContent : railContent}
      </div>
    </div>
  );
}
