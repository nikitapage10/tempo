"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

function isSafeRedirect(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setStatus("error");
      const raw = signInError.message;
      const lower = raw.toLowerCase();
      if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
        setError("Wrong email or password.");
      } else if (lower.includes("email not confirmed")) {
        setError(
          "Email confirmation is still on in Supabase — turn off “Confirm email” under Authentication → Providers → Email."
        );
      } else {
        setError(`${raw} — try again.`);
      }
      return;
    }

    router.replace(isSafeRedirect(redirectTo) ? redirectTo : "/");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">Sign in to your studio.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
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

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 pr-10 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-text-lo transition-colors hover:text-text-hi"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <p className="-mt-2 text-right text-xs">
            <Link href="/forgot-password" className="text-ice hover:underline">
              Forgot password?
            </Link>
          </p>

          {error && (
            <p className="text-sm text-warn" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={status === "loading" || !email.trim() || password.length < 1}
          >
            {status === "loading" ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-text-lo">
            No account?{" "}
            <Link
              href={
                isSafeRedirect(redirectTo)
                  ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                  : "/register"
              }
              className="text-ice hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>

        <OAuthButtons next={isSafeRedirect(redirectTo) ? redirectTo : "/"} />

        <p className="text-center text-[11px] text-text-lo">
          <Link href="/terms" className="hover:text-text-hi hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-text-hi hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
