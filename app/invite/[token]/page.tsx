"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InviteAuthCta } from "@/components/auth/invite-auth-cta";
import { createClient } from "@/lib/supabase/client";
import { COLLABORATOR_ROLES } from "@/lib/constants";

type InvitePreview = {
  track: { title: string };
  role: string;
  invited_email: string;
  account_exists: boolean | null;
};

async function fetchPreview(token: string): Promise<InvitePreview> {
  const res = await fetch(`/api/invite/${token}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "This invite isn’t available.");
  return body;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [user, setUser] = React.useState<{ email: string | null } | null | undefined>(
    undefined
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => fetchPreview(token),
    retry: false,
  });

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email ?? null } : null);
    });
  }, []);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn’t accept that invite.");
      router.push(`/track/${body.track_id}?panel=people`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t accept that invite.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel =
    previewQuery.data &&
    (COLLABORATOR_ROLES.find((r) => r.value === previewQuery.data!.role)?.label ??
      previewQuery.data.role);

  const emailMismatch =
    !!user &&
    !!previewQuery.data &&
    user.email?.trim().toLowerCase() !==
      previewQuery.data.invited_email.trim().toLowerCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-0 px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-bg-1 p-6 text-center">
        <p className="font-display text-lg font-bold tracking-tight text-text-hi">TEMPO</p>

        {previewQuery.isLoading ? (
          <div className="mt-6 h-24 animate-pulse rounded-card bg-bg-2" />
        ) : previewQuery.isError || !previewQuery.data ? (
          <p className="mt-6 text-sm text-text-lo">
            {previewQuery.error instanceof Error
              ? previewQuery.error.message
              : "This invite isn’t available. It may have expired, already been used, or the link is wrong."}
          </p>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold text-text-hi">
              You’re invited to collaborate
            </h1>
            <p className="mt-2 text-sm text-text-lo">
              Join <span className="text-text-hi">{previewQuery.data.track.title}</span> as
              a{" "}
              <span className="text-ice">{roleLabel}</span>.
            </p>
            <p className="mt-1 font-mono text-xs text-text-lo">
              Invited: {previewQuery.data.invited_email}
            </p>

            <div className="mt-6 space-y-2">
              {user === undefined ? (
                <div className="h-9 animate-pulse rounded-input bg-bg-2" />
              ) : !user ? (
                <InviteAuthCta
                  redirectPath={`/invite/${token}`}
                  invitedEmail={previewQuery.data.invited_email}
                  accountExists={previewQuery.data.account_exists ?? null}
                />
              ) : emailMismatch ? (
                <p className="text-sm text-warn">
                  You’re signed in as {user.email}, but this invite was sent to{" "}
                  {previewQuery.data.invited_email}. Sign in with that address to accept.
                </p>
              ) : (
                <Button type="button" className="w-full" disabled={busy} onClick={() => void handleAccept()}>
                  {busy ? "Accepting…" : "Accept invite"}
                </Button>
              )}
            </div>

            {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}
