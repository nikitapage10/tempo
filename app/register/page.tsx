"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AuthShell } from "@/components/auth/auth-shell";
import { isSafeRedirect, parseInviteRedirect, platformInviteLoginHref } from "@/lib/auth/invite-signup";
import { completePlatformInvite } from "@/lib/auth/complete-platform-invite";
import { LEGAL_VERSION } from "@/lib/legal";
import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";

const INVITE_MAILTO =
  "mailto:connect@nikita.page?subject=" +
  encodeURIComponent("TEMPO invite request") +
  "&body=" +
  encodeURIComponent("Hi, I'd like an invite code to try TEMPO.\n\n");

type TeamSignupPreview = {
  kind: "team";
  artist: { name: string };
  role: MemberRole;
  invited_email: string;
};

type TrackSignupPreview = {
  kind: "track";
  track: { title: string };
  invited_email: string;
};

type SignupInvitePreview = TeamSignupPreview | TrackSignupPreview;

async function fetchSignupInvitePreview(
  kind: "team" | "track",
  token: string
): Promise<SignupInvitePreview> {
  const path = kind === "team" ? `/api/team-invite/${token}` : `/api/invite/${token}`;
  const res = await fetch(path, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "This invite isn’t available.");
  if (kind === "team") {
    return {
      kind: "team",
      artist: { name: body.artist?.name ?? "" },
      role: body.role,
      invited_email: body.invited_email,
    };
  }
  return {
    kind: "track",
    track: { title: body.track?.title ?? "" },
    invited_email: body.invited_email,
  };
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
  const inviteRef = parseInviteRedirect(redirectTo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState(() => searchParams.get("invite") ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["signup-invite-preview", inviteRef?.kind, inviteRef?.token],
    queryFn: () => fetchSignupInvitePreview(inviteRef!.kind, inviteRef!.token),
    enabled: !!inviteRef,
    retry: false,
  });

  const platformInviteQuery = useQuery({
    queryKey: ["platform-invite-preview", inviteCode],
    queryFn: async () => {
      const res = await fetch("/api/auth/verify-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "That invite isn’t valid.");
      }
      return body as {
        inviteId: string | null;
        email: string | null;
        accountExists: boolean | null;
        memberRole?: string;
      };
    },
    enabled: !!inviteCode.trim() && !inviteRef,
    retry: false,
  });

  useEffect(() => {
    const invited = previewQuery.data?.invited_email;
    if (invited) setEmail(invited);
  }, [previewQuery.data?.invited_email]);

  useEffect(() => {
    const bound = platformInviteQuery.data?.email;
    if (bound && !email) setEmail(bound);
  }, [platformInviteQuery.data?.email, email]);

  useEffect(() => {
    const preview = platformInviteQuery.data;
    if (!inviteCode.trim() || inviteRef || !preview?.accountExists) return;
    router.replace(platformInviteLoginHref(inviteCode.trim(), preview.email ?? undefined));
  }, [inviteCode, inviteRef, platformInviteQuery.data, router]);

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

    const verifyBody = inviteRef
      ? inviteRef.kind === "team"
        ? { email, teamInviteToken: inviteRef.token }
        : { email, trackInviteToken: inviteRef.token }
      : { code: inviteCode, email };

    const inviteRes = await fetch("/api/auth/verify-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    });
    if (!inviteRes.ok) {
      setStatus("error");
      const body = await inviteRes.json().catch(() => null);
      setError(body?.error ?? "That invite isn’t valid.");
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
        const signInHref = inviteCode.trim()
          ? platformInviteLoginHref(inviteCode.trim(), email.trim() || undefined)
          : "/login";
        setError(
          `That email already has an account — sign in to continue as an artist.`
        );
        router.replace(signInHref);
        return;
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

    if (inviteCode.trim() && verifiedInvite.inviteId) {
      try {
        await completePlatformInvite(inviteCode.trim());
      } catch (redeemError) {
        setStatus("error");
        setError(
          redeemError instanceof Error
            ? redeemError.message
            : "Account created, but the invite could not be recorded."
        );
        return;
      }
    } else if (verifiedInvite.inviteId) {
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

    if (inviteRef?.kind === "team") {
      const acceptRes = await fetch(`/api/team-invite/${inviteRef.token}`, { method: "POST" });
      if (!acceptRes.ok) {
        router.replace(`/team-invite/${inviteRef.token}`);
        router.refresh();
        return;
      }
      router.replace("/team");
      router.refresh();
      return;
    }

    // ORIGIN comes before Import for a brand-new account; Origin itself hands
    // off to /import when it finishes or is skipped. Fresh invite signups land
    // on /welcome first so the artist can choose browser vs desktop.
    // Team-invite signups skip that — they join an existing artist.
    router.replace(isSafeRedirect(redirectTo) ? redirectTo : "/welcome");
    router.refresh();
  }

  const preview = previewQuery.data;
  const lockedToInvite = !!inviteRef;
  const subtitle = (() => {
    if (preview?.kind === "team") {
      const roleLabel = ROLE_LABELS[preview.role] ?? preview.role;
      return `Create an account to work with ${preview.artist.name} as a ${roleLabel}.`;
    }
    if (preview?.kind === "track") {
      return `Create an account to join ${preview.track.title}.`;
    }
    if (inviteRef && previewQuery.isError) {
      return previewQuery.error instanceof Error
        ? previewQuery.error.message
        : "This invite isn’t available.";
    }
    if (platformInviteQuery.data?.accountExists) {
      return "You already have a TEMPO account. Sign in to start as an artist — same login, Origin next.";
    }
    if (inviteRef) return "Create an account to accept this invite.";
    return "Create your account.";
  })();

  const membershipReady = !inviteRef || (!!preview && !previewQuery.isError);
  const needsCode = !inviteRef;

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* No name field here on purpose. Onboarding asks for it once the
              account exists: Passage opens on it for a Pro, and Origin asks
              for the artist name. Asking twice, on the screen with the least
              context, was the worse of the two places to do it. */}
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
              readOnly={lockedToInvite}
              value={email}
              onChange={(e) => {
                if (!lockedToInvite) setEmail(e.target.value);
              }}
              placeholder="you@studio.com"
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice read-only:text-text-lo"
            />
            {lockedToInvite ? (
              <p className="mt-1.5 text-xs text-text-lo">
                This invite is for this address — sign in instead if you already have an account.
              </p>
            ) : null}
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

          {needsCode ? (
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
          ) : null}

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
              (needsCode && !inviteCode.trim()) ||
              !acceptedLegal ||
              !membershipReady
            }
          >
            {status === "loading" ? "Creating…" : "Create account"}
          </Button>

          <p className="text-center text-xs text-text-lo">
            Already have an account?{" "}
            <Link
              href={
                inviteCode.trim()
                  ? platformInviteLoginHref(inviteCode.trim(), email.trim() || undefined)
                  : isSafeRedirect(redirectTo)
                  ? `/login?redirect=${encodeURIComponent(redirectTo)}${
                      email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""
                    }`
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
