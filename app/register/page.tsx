"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setStatus("error");
      const lower = signUpError.message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered")) {
        setError(
          "That email already has an account — go to Sign in, or reset the password in Supabase → Authentication → Users."
        );
      } else if (lower.includes("rate limit")) {
        setError(
          "Supabase is rate-limiting sign-ups right now — wait a bit, or create the user in the Supabase dashboard."
        );
      } else {
        setError(`${signUpError.message} — try again.`);
      }
      return;
    }

    // If email confirmation is required, session may be null.
    if (!data.session) {
      setStatus("error");
      setError(
        "Account created, but email confirmation is still required. In Supabase → Authentication → Providers → Email, turn off “Confirm email”, then sign in."
      );
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col" data-lf-chrome>
      <IntroMoment />
      <LfWindow className="edge-strip lf-window" aria-hidden />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <h1 className="font-display text-[28px] font-bold tracking-tight text-text-hi">
              TEMPO
            </h1>
            <FlareLine className="mx-auto mt-3 max-w-[120px]" />
            <p className="mt-4 text-text-lo">Create an account.</p>
          </div>

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

            <label
              htmlFor="password"
              className="mb-2 mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />

            <label
              htmlFor="confirm"
              className="mb-2 mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />

            {error && (
              <p className="mt-3 text-sm text-warn" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="mt-5 w-full"
              disabled={
                status === "loading" ||
                !email.trim() ||
                password.length < 1 ||
                confirm.length < 1
              }
            >
              {status === "loading" ? "Creating…" : "Create account"}
            </Button>

            <p className="mt-4 text-center text-xs text-text-lo">
              Already have an account?{" "}
              <Link href="/login" className="text-ice hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
