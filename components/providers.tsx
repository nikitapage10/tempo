"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { WebGlassAlertHost } from "@/components/notifications/web-glass-alert";
import {
  registerQueryClient,
  resetClientSession,
  clearAuthHandoffKeys,
} from "@/lib/auth/reset-client-session";
import { createClient } from "@/lib/supabase/client";
import { isDesktopApp } from "@/lib/desktop/bridge";
import {
  hydrateOfflineCache,
  installOfflinePersistence,
  rememberOfflineCacheUser,
} from "@/lib/offline/query-persistence";
import { flushOutbox } from "@/lib/offline/outbox";
import { ensureDeviceRegistered } from "@/lib/desktop/device";
import { DesktopWebReleaseRefresh } from "@/components/desktop/web-release-refresh";

// Reconnects don't always fire a clean 'online' event inside a long-lived
// desktop session (sleep/wake, VPN flaps), so a slow poll backstops it —
// infrequent enough to be free, frequent enough that a queued edit doesn't
// sit for long once the connection is actually back.
const OUTBOX_POLL_MS = 60_000;

function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    registerQueryClient(queryClient);
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id ?? null;
      const previousId = lastUserId.current;
      lastUserId.current = nextId;
      if (nextId) rememberOfflineCacheUser(nextId);

      // First callback hydrates whatever session this tab already has.
      // TOKEN_REFRESHED is the same person. Neither should wipe the workspace.
      if (
        previousId === undefined ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        return;
      }
      if (previousId !== nextId) {
        // Preserve a brand-new signup's Origin handoff, but clear every
        // account-scoped session flag on sign-out or a direct A -> B switch.
        if (!nextId || (previousId && nextId)) clearAuthHandoffKeys();
        void resetClientSession(queryClient);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });
    registerQueryClient(client);
    return client;
  });
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

    // Registers/refreshes this install with the signed-in account — this is
    // what flips the web app's download button to "Open in desktop" (see
    // hooks/use-devices.ts). Runs on the same cadence as the outbox flush;
    // ensureDeviceRegistered no-ops if it 401s (not signed in yet, e.g. on
    // the login screen) and is internally throttled once it succeeds, so
    // calling it every tick is cheap and self-correcting once sign-in lands.
    const register = () => void ensureDeviceRegistered();
    register();
    const registerInterval = setInterval(register, OUTBOX_POLL_MS);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", flush);
      clearInterval(interval);
      clearInterval(registerInterval);
    };
    // queryClient is stable for the lifetime of this component (useState initializer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionBoundary>
        <ToastProvider>
          <DesktopWebReleaseRefresh />
          {hydrated ? children : null}
          <WebGlassAlertHost />
        </ToastProvider>
      </AuthSessionBoundary>
    </QueryClientProvider>
  );
}
