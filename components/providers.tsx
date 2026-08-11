"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { isDesktopApp } from "@/lib/desktop/bridge";
import { hydrateOfflineCache, installOfflinePersistence } from "@/lib/offline/query-persistence";
import { flushOutbox } from "@/lib/offline/outbox";

// Reconnects don't always fire a clean 'online' event inside a long-lived
// desktop session (sleep/wake, VPN flaps), so a slow poll backstops it —
// infrequent enough to be free, frequent enough that a queued edit doesn't
// sit for long once the connection is actually back.
const OUTBOX_POLL_MS = 60_000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  // Always starts true so the client's first hydration pass matches the
  // server-rendered HTML (isDesktopApp() is necessarily false during SSR —
  // there's no window). Only flips inside the effect below, which runs
  // strictly after hydration, so there's no mismatch — just a brief,
  // harmless flicker on desktop while the offline cache loads.
  const [hydrated, setHydrated] = useState(true);

  useEffect(() => {
    if (!isDesktopApp()) return;

    let active = true;
    setHydrated(false);
    void hydrateOfflineCache(queryClient).finally(() => {
      if (active) setHydrated(true);
    });
    const unsubscribe = installOfflinePersistence(queryClient);

    const flush = () => void flushOutbox();
    flush();
    window.addEventListener("online", flush);
    const interval = setInterval(flush, OUTBOX_POLL_MS);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
    // queryClient is stable for the lifetime of this component (useState initializer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{hydrated ? children : null}</ToastProvider>
    </QueryClientProvider>
  );
}
