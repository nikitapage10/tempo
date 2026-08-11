"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { isDesktopApp } from "@/lib/desktop/bridge";

/**
 * planning/desktop/01-PRODUCT-AND-UX-SPEC.md "Offline": a calm banner while
 * offline on desktop — Board, Tracks, Projects, Tasks, and Calendar keep
 * working from the last-synced cache; changes are queued and sent once
 * reconnected (lib/offline/outbox.ts). Desktop only — the plain web app has
 * no offline cache to fall back to, so there's nothing reassuring to say here.
 */
export function OfflineBanner() {
  // Same hydration-mismatch guard as components/desktop/download-button.tsx:
  // window.tempoDesktop and navigator.onLine are both client-only facts that
  // can legitimately differ from the server's render, so nothing here is
  // trusted until after mount.
  const [mounted, setMounted] = React.useState(false);
  const online = useOnlineStatus();

  React.useEffect(() => setMounted(true), []);

  if (!mounted || online || !isDesktopApp()) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-input border border-line bg-bg-2/60 px-3 py-2 text-xs text-text-lo">
      <WifiOff className="size-3.5 shrink-0" strokeWidth={1.75} />
      You’re offline — showing what was last synced. Board, Tracks, Projects,
      Tasks, and Calendar still work; changes send once you’re back online.
    </div>
  );
}
