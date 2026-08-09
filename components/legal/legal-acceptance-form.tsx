"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_VERSION } from "@/lib/legal";
import { Button } from "@/components/ui/button";

export function LegalAcceptanceForm({ next }: { next: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, version: LEGAL_VERSION }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Couldn’t record your acceptance.");
      }
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t record your acceptance.",
      );
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-6 sm:p-8">
      <div className="flex size-10 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
        <ShieldCheck className="size-5 text-ice" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-text-hi">
        One quick agreement before you continue
      </h1>
      <p className="mt-3 text-sm leading-6 text-text-lo">
        TEMPO now has clear terms for using the product and a privacy policy
        explaining how account, studio, and community data are handled.
      </p>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-input border border-line bg-bg-2/70 p-4 text-sm leading-6 text-text-lo transition-colors hover:border-ice/35">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--ice)]"
        />
        <span>
          I have read and agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-ice hover:underline"
          >
            Terms of use
          </Link>{" "}
          and acknowledge the{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-ice hover:underline"
          >
            Privacy policy
          </Link>
          .
        </span>
      </label>

      {error ? (
        <p className="mt-3 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={!accepted || busy}>
          {busy ? "Saving…" : "Agree and continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </div>
      <p className="mt-5 text-xs leading-5 text-text-lo">
        Don’t agree and want this account removed? Email{" "}
        <a href="mailto:connect@nikita.page" className="text-ice hover:underline">
          connect@nikita.page
        </a>
        .
      </p>
    </form>
  );
}
