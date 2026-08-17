"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { isDesktopApp } from "@/lib/desktop/bridge";

function warmupKey(userId: string) {
  return `tempo:session-call-warmup:${userId}`;
}

export function hasSeenCallWarmup(userId: string): boolean {
  if (typeof window === "undefined") return true;
  if (!isDesktopApp()) return true;
  try {
    return window.localStorage.getItem(warmupKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markCallWarmupSeen(userId: string) {
  try {
    window.localStorage.setItem(warmupKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function CallWarmupPanel({
  userId,
  onReady,
  onRelay,
}: {
  userId: string;
  onReady: () => void;
  onRelay: () => void;
}) {
  const windows = typeof window !== "undefined" && window.tempoDesktop?.platform === "windows";

  return (
    <div className="panel-quiet mx-auto max-w-lg space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold text-text-hi">Get ready for the call</h2>
      {windows ? (
        <p className="text-sm leading-relaxed text-text-lo">
          Windows will ask once for network access so the call can reach the other people in the room.
          Choose Private networks. It will not ask again after that.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-text-lo">
          TEMPO Desktop will ask for the microphone, camera, and screen recording the first time you join.
          If macOS says no, open System Settings and allow TEMPO there.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            markCallWarmupSeen(userId);
            onReady();
          }}
        >
          Get ready
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            markCallWarmupSeen(userId);
            onRelay();
          }}
        >
          Having trouble connecting?
        </Button>
      </div>
      <p className="text-xs text-text-lo">
        Having trouble connecting uses a slower path that avoids the Windows network prompt.
      </p>
    </div>
  );
}
