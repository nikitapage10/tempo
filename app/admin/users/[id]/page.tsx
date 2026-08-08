"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusChip } from "@/components/admin/admin-table";
import { useAdminUser, useAdminUserActions } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";
}
function bytes(value: number) {
  return value < 1024 ** 2
    ? `${Math.round(value / 1024)} KB`
    : `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function role(value: string | undefined) {
  if (value === "administrator") return "Team administrator";
  if (value === "team_member") return "Team member";
  return "Beta artist";
}

type OpaqueSnapshot = {
  id: string;
  createdAt: string;
  bytes: number;
  source: string;
  trackCount: number;
  projectCount: number;
  spaceCount: number;
};

export default function AdminUserPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading, error } = useAdminUser(params.id);
  const actions = useAdminUserActions(params.id);
  const [confirm, setConfirm] = React.useState<"suspend" | "delete" | null>(
    null,
  );
  const [snapshots, setSnapshots] = React.useState<OpaqueSnapshot[]>([]);
  const [snapsLoading, setSnapsLoading] = React.useState(true);
  const [snapBusy, setSnapBusy] = React.useState(false);

  const loadSnapshots = React.useCallback(async () => {
    setSnapsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/catalog`);
      if (!res.ok) throw new Error("Couldn’t load backup status.");
      const body = (await res.json()) as { snapshots?: OpaqueSnapshot[] };
      setSnapshots(body.snapshots ?? []);
    } catch {
      setSnapshots([]);
    } finally {
      setSnapsLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  async function suspend() {
    try {
      await actions.suspend.mutateAsync("Suspended by platform administrator");
      setConfirm(null);
      toast("Member suspended.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t suspend member.");
    }
  }
  async function reactivate() {
    try {
      await actions.reactivate.mutateAsync();
      toast("Member reactivated.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t reactivate member.");
    }
  }
  async function remove() {
    if (!user) return;
    try {
      await actions.remove.mutateAsync(user.email);
      setConfirm(null);
      toast("Member deleted.", "ok");
      router.replace("/admin/users");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t delete member.");
    }
  }

  async function takeSnapshot() {
    setSnapBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/catalog`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Couldn’t save snapshot.");
      }
      toast("Snapshot saved — contents stay private to the member.", "ok");
      await loadSnapshots();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t save snapshot.");
    } finally {
      setSnapBusy(false);
    }
  }

  if (isLoading) return <div className="panel h-80 animate-pulse" />;
  if (error || !user)
    return (
      <div className="panel-quiet p-4 text-sm text-warn">
        {error?.message ?? "Member not found."}
      </div>
    );

  const details = [
    ["Email", user.email],
    ["Provider", user.provider],
    ["Joined", date(user.createdAt)],
    ["Last sign-in", date(user.lastSignInAt)],
    ["Tracks", user.trackCount],
    ["Projects", user.projectCount],
    ["Storage", bytes(user.storageBytes)],
    ["Assistant messages", user.assistant.messages],
    ["Assistant escalations", user.assistant.escalations],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.publicProfile?.display_name ?? user.email}
        subtitle="Member account detail"
        actions={<StatusChip status={user.status} />}
      />
      <section className="panel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={String(label)}>
              <p className="label-mono">{label}</p>
              <p className="mt-1 break-words text-sm text-text-hi tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>
      {user.publicProfile ? (
        <section className="panel-quiet p-5">
          <p className="label-mono">Published profile</p>
          <p className="mt-2 text-sm text-text-hi">
            {user.publicProfile.display_name}
            {user.publicProfile.handle
              ? ` · @${user.publicProfile.handle}`
              : ""}
          </p>
          <p className="mt-1 text-xs text-text-lo">
            Visibility: {user.publicProfile.visibility}
          </p>
        </section>
      ) : null}
      <section className="panel-quiet p-5">
        <p className="label-mono">Invite</p>
        <p className="mt-2 text-sm text-text-hi">
          {user.invite
            ? `${user.invite.code} · ${date(user.invite.redeemedAt)}`
            : "Legacy or no recorded invite"}
        </p>
        {user.invite ? <p className="mt-1 text-xs text-ice">{role(user.invite.memberRole)}</p> : null}
      </section>
      {user.onboarding ? (
        <section className="panel-quiet p-5">
          <p className="label-mono">Onboarding health</p>
          {!user.onboarding.eligible ? (
            <p className="mt-2 text-sm text-text-lo">This account predates the tracked onboarding flow.</p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-text-lo">Main tour</p><p className="mt-1 text-sm text-text-hi">{user.onboarding.mainTourCompletedAt ? "Complete" : "Not finished"}</p></div>
              <div><p className="text-xs text-text-lo">Starter checklist</p><p className="mt-1 text-sm text-text-hi">{user.onboarding.checklistCompletedAt ? "Complete" : user.onboarding.checklistDismissedAt ? "Removed" : `${user.onboarding.checklistSteps} of 6`}</p></div>
              <div><p className="text-xs text-text-lo">Page introductions</p><p className="mt-1 text-sm text-text-hi">{user.onboarding.pageToursCompleted} completed</p></div>
              <div><p className="text-xs text-text-lo">Welcome connection</p><p className="mt-1 text-sm text-text-hi">{user.onboarding.welcomeMessageSentAt ? "Message sent" : "Waiting for profile"}</p></div>
              <div><p className="text-xs text-text-lo">Last onboarding activity</p><p className="mt-1 text-sm text-text-hi">{date(user.onboarding.lastSeenAt)}</p></div>
            </div>
          )}
        </section>
      ) : null}
      <section className="panel-quiet p-5">
        <p className="label-mono">Catalog backups</p>
        <p className="mt-2 text-sm text-text-lo">
          Status only — TEMPO never shows or downloads a member’s catalog
          contents here. For recovery, use Supabase database backups or ask them
          to export/restore from Settings → Your data.
        </p>
        <div className="mt-3">
          <Button
            variant="secondary"
            disabled={snapBusy}
            onClick={() => void takeSnapshot()}
          >
            {snapBusy ? "Saving…" : "Save snapshot now"}
          </Button>
        </div>
        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {snapsLoading ? (
            <p className="text-xs text-text-lo">Loading backup status…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-xs text-text-lo">No snapshots yet.</p>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="well flex items-center justify-between rounded-input px-3 py-2 text-xs"
              >
                <span className="text-text-hi">{date(snap.createdAt)}</span>
                <span className="tabular-nums text-text-lo">
                  {snap.source} · {snap.trackCount} tracks · {bytes(snap.bytes)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="panel-quiet p-5">
        <p className="label-mono">Recent account activity</p>
        <div className="mt-3 space-y-2">
          {user.accountEvents.length ? (
            user.accountEvents.map((event) => (
              <div
                key={event.id}
                className="well flex items-center justify-between rounded-input px-3 py-2 text-xs"
              >
                <span className="text-text-hi">
                  {event.event_type.replaceAll("_", " ")}
                </span>
                <span className="tabular-nums text-text-lo">
                  {date(event.created_at)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-lo">No recent account events.</p>
          )}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {user.status === "suspended" ? (
          <Button
            onClick={() => void reactivate()}
            disabled={actions.reactivate.isPending}
          >
            {actions.reactivate.isPending ? "…" : "Reactivate"}
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setConfirm("suspend")}>
            Suspend member
          </Button>
        )}
        <Button variant="destructive" onClick={() => setConfirm("delete")}>
          Delete account
        </Button>
      </div>
      <ConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(o) => setConfirm(o ? "suspend" : null)}
        title="Suspend this member?"
        description="Their sessions will stop and sign-in will be refused until an admin reactivates the account."
        confirmLabel="Suspend"
        typedValue={user.email}
        busy={actions.suspend.isPending}
        onConfirm={suspend}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => setConfirm(o ? "delete" : null)}
        title="Permanently delete this account?"
        description="This removes the auth account and data connected by database cascades. It cannot be undone."
        confirmLabel="Delete account"
        typedValue={user.email}
        busy={actions.remove.isPending}
        onConfirm={remove}
      />
    </div>
  );
}
