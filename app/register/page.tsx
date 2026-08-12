"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AuthShell } from "@/components/auth/auth-shell";
import { LEGAL_VERSION } from "@/lib/legal";

const INVITE_MAILTO =
  "mailto:connect@nikita.page?subject=" +
  encodeURIComponent("TEMPO invite request") +
  "&body=" +
  encodeURIComponent("Hi, I'd like an invite code to try TEMPO.\n\n");

function isSafeRedirect(path: string | null): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState(() => searchParams.get("invite") ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
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
      setError("Passwords don't match.");
      return;
    }
    if (!acceptedLegal) {
      setError("Please agree to the Terms and acknowledge the Privacy policy.");
      return;
    }

    setStatus("loading");

    const inviteRes = await fetch("/api/auth/verify-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode, email }),
    });
    if (!inviteRes.ok) {
      setStatus("error");
      const body = await inviteRes.json().catch(() => null);
      setError(body?.error ?? "That invite code isn’t valid.");
      return;
    }
    const verifiedInvite = await inviteRes.json().catch(() => ({ inviteId: null }));

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          legal_terms_version: LEGAL_VERSION,
          legal_terms_accepted_at: new Date().toISOString(),
        },
      },
    });

    if (signUpError) {
      setStatus("error");
      const lower = signUpError.message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered")) {
        setError("That email already has an account — go to Sign in, or reset in Supabase → Authentication → Users.");
      } else if (lower.includes("rate limit")) {
        setError("Supabase is rate-limiting sign-ups right now — wait a bit, or create the user in the Supabase dashboard.");
      } else {
        setError(`${signUpError.message} — try again.`);
      }
      return;
    }

    if (!data.session) {
      setStatus("error");
      setError(
        "Account created, but email confirmation is still required. In Supabase → Authentication → Providers → Email, turn off “Confirm email”, then sign in."
      );
      return;
    }

    if (verifiedInvite.inviteId) {
      const redeemRes = await fetch("/api/auth/redeem-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: verifiedInvite.inviteId }),
      });
      if (!redeemRes.ok) {
        setStatus("error");
        const body = await redeemRes.json().catch(() => null);
        setError(body?.error ?? "Account created, but the invite could not be recorded.");
        return;
      }
    }

    // ORIGIN comes before Import for a brand-new account; Origin itself hands
    // off to /import when it finishes or is skipped. Fresh invite signups land
    // on /welcome first so the artist can choose browser vs desktop.
    router.replace(isSafeRedirect(redirectTo) ? redirectTo : "/welcome");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">Create your account.</p>
        </div>

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

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block font-mono text-xs uppercase tracking-[0.08em] text-text-lo"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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

          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block font-mono text-xs uppercase tracking-[0.08em] text-text-lo"
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
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />
          </div>

          <div>
            <label
              htmlFor="invite"
              className="mb-1.5 block font-mono text-xs uppercase tracking-[0.08em] text-text-lo"
            >
              Invite code
            </label>
            <input
              id="invite"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            />
            <p className="mt-1.5 text-xs text-text-lo">
              Don’t have one?{" "}
              <a href={INVITE_MAILTO} className="text-ice hover:underline">
                Request an invite
              </a>
              .
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-input border border-line bg-bg-2/70 p-3 text-xs leading-5 text-text-lo transition-colors hover:border-ice/35">
            <input
              type="checkbox"
              required
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--ice)]"
            />
            <span>
              I agree to the{" "}
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

          {error && (
            <p className="text-sm text-warn" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              status === "loading" ||
              !email.trim() ||
              password.length < 1 ||
              confirm.length < 1 ||
              !inviteCode.trim() ||
              !acceptedLegal
            }
          >
            {status === "loading" ? "Creating…" : "Create account"}
          </Button>

          <p className="text-center text-xs text-text-lo">
            Already have an account?{" "}
            <Link
              href={
                isSafeRedirect(redirectTo)
                  ? `/login?redirect=${encodeURIComponent(redirectTo)}`
                  : "/login"
              }
              className="text-ice hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>

      </div>
    </AuthShell>
  );
}
