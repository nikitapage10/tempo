"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { IntroMoment } from "@/components/intro-moment";
import { getAuthCallbackUrl } from "@/lib/site";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-bg-0">
      <IntroMoment />
      <div className="edge-strip" aria-hidden />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <h1 className="font-display text-[28px] font-bold tracking-tight text-text-hi">
              TEMPO
            </h1>
            <div className="flare-line mx-auto mt-3 max-w-[120px]" />
            <p className="mt-4 text-text-lo">
              Sign in with a magic link. No password needed.
            </p>
          </div>

          {status === "sent" ? (
            <div className="rounded-card border border-line bg-bg-1 p-6 text-center shadow-raise">
              <p className="text-text-hi">Check your email</p>
              <p className="mt-2 text-sm text-text-lo">
                We sent a sign-in link to{" "}
                <span className="font-mono text-ice">{email}</span>. Open it
                on this device to continue.
              </p>
              <button
                type="button"
                className="mt-4 text-sm text-ice hover:underline"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-card border border-line bg-bg-1 p-6 shadow-raise"
            >
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              />

              {error && (
                <p className="mt-3 text-sm text-warn" role="alert">
                  {error} — try again, or check that the email is correct.
                </p>
              )}

              <Button
                type="submit"
                className="mt-5 w-full"
                disabled={status === "loading" || !email.trim()}
              >
                {status === "loading" ? "Sending link…" : "Send magic link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
