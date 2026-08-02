"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setError("Passwords don’t match.");
      return;
    }

    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("error");
      setError(
        "This reset link isn’t active anymore. Request a new one from the forgot-password page.",
      );
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus("error");
      setError(`${updateError.message} — try again.`);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div>
          <h1>
            <Wordmark size={32} />
          </h1>
          <p className="mt-4 text-sm text-text-lo">Choose a new password.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
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

          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
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
            disabled={status === "loading" || password.length < 1 || confirm.length < 1}
          >
            {status === "loading" ? "Saving…" : "Save new password"}
          </Button>

          <p className="text-center text-xs text-text-lo">
            Link expired?{" "}
            <Link href="/forgot-password" className="text-ice hover:underline">
              Request another
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
