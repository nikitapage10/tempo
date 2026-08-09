"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  HelpCircle,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupportReportDialog } from "@/components/support/support-report-dialog";
import { useToast } from "@/components/ui/toast";

type IdentityProvider = "email" | "google" | "azure" | "apple" | string;

function providerLabel(provider: IdentityProvider): string {
  switch (provider) {
    case "email":
      return "Email & password";
    case "google":
      return "Google";
    case "azure":
      return "Microsoft";
    case "apple":
      return "Apple";
    default:
      return provider;
  }
}

export function AccountPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useCurrentUser();
  const [providers, setProviders] = React.useState<IdentityProvider[]>([]);
  const [signingOut, setSigningOut] = React.useState(false);
  const [emailDraft, setEmailDraft] = React.useState("");
  const [emailBusy, setEmailBusy] = React.useState(false);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const email = user?.email ?? null;
  const hasPassword = providers.includes("email");

  React.useEffect(() => {
    if (email) setEmailDraft(email);
  }, [email]);

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const identities = data.user?.identities ?? [];
      const list = identities.map((i) => i.provider as IdentityProvider);
      setProviders(list.length ? list : data.user?.email ? ["email"] : []);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleEmailSave(e: React.FormEvent) {
    e.preventDefault();
    const next = emailDraft.trim().toLowerCase();
    if (!next || next === email?.toLowerCase()) return;
    setEmailBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast(
        "Check your inbox — confirm the new address before it becomes permanent.",
        "ok",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (newPassword.length < 8) {
      toast("Use at least 8 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New passwords don’t match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const supabase = createClient();
      if (hasPassword && currentPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (reauthError) throw new Error("Current password isn’t right.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password updated.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleDelete() {
    if (!email) return;
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Couldn’t delete account.");
      const supabase = createClient();
      await supabase.auth.signOut();
      toast("Account deleted.", "ok");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t delete account.");
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  }

  if (user === undefined) {
    return <div className="panel h-40 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <Mail className="size-4 text-ice" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold tracking-tight text-text-hi">
              Sign-in
            </p>
            <p className="mt-1 text-sm text-text-lo">
              How you get into TEMPO on this account.
            </p>
            <p className="mt-3 text-xs text-text-lo">
              Signed in with{" "}
              <span className="text-text-hi">
                {providers.length
                  ? providers.map(providerLabel).join(" · ")
                  : "your account"}
              </span>
            </p>

            <form onSubmit={handleEmailSave} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={
                  emailBusy ||
                  !emailDraft.trim() ||
                  emailDraft.trim().toLowerCase() === email?.toLowerCase()
                }
              >
                {emailBusy ? "Saving…" : "Update email"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-bg-2">
            <KeyRound className="size-4 text-text-lo" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold tracking-tight text-text-hi">
              Password
            </p>
            <p className="mt-1 text-sm text-text-lo">
              {hasPassword
                ? "Change the password for email sign-in."
                : "You signed in with a provider. You can still set a password if you want email sign-in too."}
            </p>

            <form onSubmit={handlePasswordSave} className="mt-4 space-y-3">
              {hasPassword ? (
                <div>
                  <Label htmlFor="account-current-password">Current password</Label>
                  <Input
                    id="account-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="account-confirm-password">Confirm new password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={
                  passwordBusy ||
                  !newPassword ||
                  !confirmPassword ||
                  (hasPassword && !currentPassword)
                }
              >
                {passwordBusy ? "Saving…" : hasPassword ? "Update password" : "Set password"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel-quiet p-5">
          <div className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <Eye className="size-4 text-ice" />
          </div>
          <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
            Profile visibility
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">
            Who can see your published artist profile on the network.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" asChild>
            <Link href="/artist">Open Artist</Link>
          </Button>
        </div>
        <div className="panel-quiet p-5">
          <div className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <MessageCircle className="size-4 text-ice" />
          </div>
          <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
            Direct messages
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">
            Who can start a DM with you — anyone, connections, or nobody.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" asChild>
            <Link href="/artist">Manage on Artist</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel-quiet p-5">
          <div className="flex size-9 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <HelpCircle className="size-4 text-ice" />
          </div>
          <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
            Help &amp; support
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">
            Report a bug, ask for help, or share feedback.
          </p>
          <div className="mt-4">
            <SupportReportDialog compact />
          </div>
        </div>

        <div className="panel-quiet p-5">
          <div className="flex size-9 items-center justify-center rounded-full border border-line bg-bg-2">
            <UserRound className="size-4 text-text-lo" />
          </div>
          <p className="mt-4 font-display text-base font-semibold tracking-tight text-text-hi">
            This device
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">
            Sign out of TEMPO on this browser. Your catalog stays in the cloud.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="mr-1.5 size-3.5" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>

      <section className="panel-quiet p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
            <ShieldCheck className="size-4 text-ice" />
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight text-text-hi">
              Legal &amp; privacy
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-lo">
              Your private music and workspace content stay yours. They are
              stored to run TEMPO, not browsed in the admin portal, sold, used
              for ads, or used to train AI models.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href="/terms" className="text-ice hover:underline">
                Terms of use
              </Link>
              <Link href="/privacy" className="text-ice hover:underline">
                Privacy policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-quiet border-warn/20 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-warn/25 bg-warn/10">
            <Trash2 className="size-4 text-warn" />
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight text-text-hi">
              Delete account
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-lo">
              Permanently removes your sign-in and catalog data tied to this
              account. Export from Catalog first if you want a copy. This cannot
              be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              disabled={!email}
              onClick={() => setDeleteOpen(true)}
            >
              Delete my account
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your TEMPO account?"
        description="Everything owned by this account is removed. Type your email to confirm."
        confirmLabel="Delete account"
        typedValue={email ?? undefined}
        busy={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
