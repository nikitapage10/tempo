"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { InviteAuthCta } from "@/components/auth/invite-auth-cta";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import { AREA_KEYS, AREA_LABELS, areaLevel, type AreaGrants } from "@/lib/team/areas";

type TeamInvitePreview = {
  artist: { name: string };
  role: MemberRole;
  invited_email: string;
  account_exists: boolean | null;
  areas: AreaGrants;
  relationship_label: string | null;
  invite_message: string | null;
};

async function fetchPreview(token: string): Promise<TeamInvitePreview> {
  const res = await fetch(`/api/team-invite/${token}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "This invite isn’t available.");
  return body;
}

export default function TeamInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [user, setUser] = React.useState<{ email: string | null } | null | undefined>(
    undefined
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["team-invite-preview", token],
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
      const res = await fetch(`/api/team-invite/${token}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn’t accept that invite.");
      // Joining a team earns the Passage welcome, the same as an admin-issued
      // team invite. Its own guard sends anyone who has already been through
      // it (or isn't owed it) straight on to /team instead.
      router.push("/passage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t accept that invite.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = previewQuery.data ? previewQuery.data.relationship_label || ROLE_LABELS[previewQuery.data.role] : null;

  const emailMismatch =
    !!user &&
    !!previewQuery.data &&
    user.email?.trim().toLowerCase() !==
      previewQuery.data.invited_email.trim().toLowerCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-0 px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-bg-1 p-6 text-center">
        <Wordmark size={28} className="justify-center" />

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
              You’re invited to join a team
            </h1>
            <p className="mt-2 text-sm text-text-lo">
              Work with{" "}
              <span className="text-text-hi">{previewQuery.data.artist.name}</span> as a{" "}
              <span className="text-ice">{roleLabel}</span>.
            </p>
            <p className="mt-1 font-mono text-xs text-text-lo">
              Invited: {previewQuery.data.invited_email}
            </p>
            {previewQuery.data.invite_message ? <p className="mt-4 rounded-input border-l-2 border-ice bg-bg-2 p-3 text-left text-sm text-text-hi">{previewQuery.data.invite_message}</p> : null}
            <div className="mt-4 rounded-input border border-line bg-bg-2/50 p-3 text-left">
              <p className="label-mono mb-2">What you can access</p>
              <dl className="space-y-1.5">{AREA_KEYS.map((area) => <div key={area} className="flex justify-between gap-3 text-xs"><dt className="text-text-lo">{AREA_LABELS[area]}</dt><dd className="capitalize text-text-hi">{areaLevel(previewQuery.data.areas, area)}</dd></div>)}</dl>
            </div>

            <div className="mt-6 space-y-2">
              {user === undefined ? (
                <div className="h-9 animate-pulse rounded-input bg-bg-2" />
              ) : !user ? (
                <InviteAuthCta
                  redirectPath={`/team-invite/${token}`}
                  invitedEmail={previewQuery.data.invited_email}
                  accountExists={previewQuery.data.account_exists ?? null}
                />
              ) : emailMismatch ? (
                <p className="text-sm text-warn">
                  You’re signed in as {user.email}, but this invite was sent to{" "}
                  {previewQuery.data.invited_email}. Sign in with that address to accept.
                </p>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void handleAccept()}
                >
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
