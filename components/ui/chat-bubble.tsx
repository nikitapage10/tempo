"use client";

import * as React from "react";

/** Typing indicator dot. Respects reduced motion via the animate-pulse utility. */
export function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-pulse rounded-full bg-text-lo motion-reduce:animate-none"
      style={{ animationDelay: delay }}
    />
  );
}

/** One message in a TEMPO ↔ artist transcript. */
export function Bubble({
  from,
  children,
}: {
  from: "tempo" | "artist";
  children: React.ReactNode;
}) {
  const isArtist = from === "artist";

  if (isArtist) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-card rounded-br-sm border border-ice/30 bg-gradient-to-br from-ice/15 to-ice/5 px-4 py-3 shadow-e1">
          {children}
        </div>
      </div>
    );
  }

  // TEMPO speaks with the app's own light beside it, so the two voices are
  // distinguishable at a glance rather than by alignment alone.
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-bg-2 shadow-e1"
      >
        <span className="block size-3 rounded-full bg-gradient-to-br from-ice via-white to-amber" />
      </span>
      <div className="min-w-0 max-w-[85%] rounded-card rounded-tl-sm border border-line bg-bg-2/80 px-4 py-3 shadow-e1">
        {children}
      </div>
    </div>
  );
}
