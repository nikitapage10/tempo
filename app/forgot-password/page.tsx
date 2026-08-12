"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    if (resetError) {
      setStatus("error");
      setError(`${resetError.message} — try again.`);
      return;
    }

    setStatus("sent");
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">
            Reset your password.
          </p>
        </div>

        {status === "sent" ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-text-hi">
              If an account exists for{" "}
              <span className="text-ice">{email.trim()}</span>, we sent a reset
              link. Open it on this device, then choose a new password.
            </p>
            <p className="text-xs text-text-lo">
              Nothing in the inbox? Check spam, wait a minute, or try again.
              The link expires after a short while.
            </p>
            <p className="text-center text-xs text-text-lo">
              <Link href="/login" className="text-ice hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-xs uppercase tracking-[0.08em] text-text-lo"
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
                className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              />
            </div>

            {error ? (
              <p className="text-sm text-warn" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={status === "loading" || !email.trim()}
            >
              {status === "loading" ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-center text-xs text-text-lo">
              Remembered it?{" "}
              <Link href="/login" className="text-ice hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
