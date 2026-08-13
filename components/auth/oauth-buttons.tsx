"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { GoogleMark, MicrosoftMark } from "@/components/auth/provider-marks";
import {
  canOpenExternal,
  isDesktopApp,
  openExternal,
} from "@/lib/desktop/bridge";

/** Supabase's own provider ids — "azure" is how it names Microsoft/Entra ID. */
type Provider = "google" | "azure";

const PROVIDERS: {
  id: Provider;
  label: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
}[] = [
  { id: "google", label: "Google", Icon: GoogleMark },
  { id: "azure", label: "Microsoft", Icon: MicrosoftMark },
];

type OAuthButtonsProps = {
  /** Where to land after a successful sign-in — "/" for login, "/import" for register. */
  next?: string;
};

/**
 * "Continue with…" buttons for Google and Microsoft.
 *
 * On TEMPO Desktop (shells with openExternal), OAuth runs in the system
 * browser so Google/Microsoft don't flag Electron as insecure, then returns
 * via /auth/desktop-bridge → tempo://auth/callback → /auth/callback in-app.
 * Older desktop shells and the web app keep the normal in-tab redirect.
 */
export function OAuthButtons({ next = "/" }: OAuthButtonsProps) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState<Provider | null>(null);

  React.useEffect(() => {
    if (!pending) return;
    const clear = () => setPending(null);
    const timer = window.setTimeout(clear, 12_000);
    window.addEventListener("pageshow", clear);
    window.addEventListener("focus", clear);
    const onVis = () => {
      if (document.visibilityState === "visible") clear();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("focus", clear);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pending]);

  async function handleClick(provider: Provider) {
    setPending(provider);
    const supabase = createClient();
    const useSystemBrowser = isDesktopApp() && canOpenExternal();
    const redirectTo = useSystemBrowser
      ? `${window.location.origin}/auth/desktop-bridge?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: useSystemBrowser,
        ...(provider === "azure"
          ? { scopes: "email openid profile offline_access" }
          : {}),
      },
    });

    if (error) {
      setPending(null);
      const lower = error.message.toLowerCase();
      if (
        lower.includes("provider is not enabled") ||
        lower.includes("unsupported provider")
      ) {
        toast(
          `${PROVIDERS.find((p) => p.id === provider)?.label} sign-in isn’t turned on yet.`
        );
      } else {
        toast(`Couldn’t start that sign-in — ${error.message}`);
      }
      return;
    }

    if (useSystemBrowser) {
      const url = data?.url;
      if (!url) {
        setPending(null);
        toast("Couldn’t open the sign-in browser.");
        return;
      }
      const opened = await openExternal(url);
      if (!opened) {
        // Older length limits / IPC failures — fall through to will-navigate,
        // which opens the system browser without the IPC cap.
        window.location.assign(url);
        return;
      }
      toast("Finish signing in in your browser — you’ll return to TEMPO.", "info");
      // Keep pending briefly so double-clicks don't spawn two browser tabs;
      // focus/timeout clears it when they come back.
    }
  }

  const disabled = pending !== null;

  return (
    <div>
      <div className="relative flex items-center justify-center">
        <span className="w-full border-t border-line" aria-hidden />
        <span className="absolute bg-bg-1 px-3 text-xs text-text-lo">
          or continue with
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {PROVIDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => void handleClick(id)}
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-input border border-line bg-bg-2 text-sm text-text-hi transition-colors duration-hover hover:bg-bg-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-50"
          >
            <Icon className="size-4 shrink-0" />
            {pending === id
              ? isDesktopApp() && canOpenExternal()
                ? "Check your browser…"
                : "Redirecting…"
              : `Continue with ${label}`}
          </button>
        ))}
      </div>
    </div>
  );
}
