"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { AppleMark, GoogleMark, MicrosoftMark } from "@/components/auth/provider-marks";

/** Supabase's own provider ids — "azure" is how it names Microsoft/Entra ID. */
type Provider = "google" | "azure" | "apple";

const PROVIDERS: {
  id: Provider;
  label: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
}[] = [
  { id: "google", label: "Google", Icon: GoogleMark },
  { id: "azure", label: "Microsoft", Icon: MicrosoftMark },
  { id: "apple", label: "Apple", Icon: AppleMark },
];

type OAuthButtonsProps = {
  /** Where to land after a successful sign-in — "/" for login, "/import" for register. */
  next?: string;
};

/**
 * "Continue with…" buttons for Google, Microsoft, and Apple.
 *
 * Each provider has to be turned on in Supabase → Authentication → Providers
 * (and have its own app registered with that vendor) before its button will
 * actually complete a sign-in — see SECURITY-AND-PERMISSIONS.md. Until then
 * the button still renders; Supabase just returns an error, shown as a toast.
 */
export function OAuthButtons({ next = "/" }: OAuthButtonsProps) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState<Provider | null>(null);

  async function handleClick(provider: Provider) {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setPending(null);
      const lower = error.message.toLowerCase();
      if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
        toast(`${PROVIDERS.find((p) => p.id === provider)?.label} sign-in isn’t turned on yet.`);
      } else {
        toast(`Couldn’t start that sign-in — ${error.message}`);
      }
      return;
    }
    // On success the browser is already navigating to the provider; nothing left to do.
  }

  const disabled = pending !== null;

  return (
    <div>
      <div className="relative flex items-center justify-center">
        <span className="w-full border-t border-line" aria-hidden />
        <span className="absolute bg-bg-1 px-3 text-xs text-text-lo">or continue with</span>
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
            {pending === id ? "Redirecting…" : `Continue with ${label}`}
          </button>
        ))}
      </div>
    </div>
  );
}
