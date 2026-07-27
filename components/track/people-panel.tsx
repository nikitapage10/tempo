"use client";

import * as React from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useCollaboratorMutations, useCollaborators } from "@/hooks/use-collaborators";
import { useCurrentUser } from "@/hooks/use-current-user";
import { inviteUrl } from "@/lib/api/collaborators";
import { COLLABORATOR_ROLES } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type { CollaboratorRole, TrackCollaborator } from "@/lib/types";
import { cn } from "@/lib/utils";

type PeoplePanelProps = {
  trackId: string;
  ownerUserId: string;
  isOwner: boolean;
};

function roleLabel(role: CollaboratorRole): string {
  return COLLABORATOR_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function PeoplePanel({ trackId, ownerUserId, isOwner }: PeoplePanelProps) {
  const user = useCurrentUser();
  const { data: collaborators = [], isLoading } = useCollaborators(trackId);
  const { invite, revoke, changeRole } = useCollaboratorMutations(trackId);
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<CollaboratorRole>("commenter");
  const [busy, setBusy] = React.useState(false);
  const [freshInvite, setFreshInvite] = React.useState<{ url: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = React.useState<string | null>(null);

  const active = collaborators.filter((c) => c.status !== "revoked");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { rawToken } = await invite.mutateAsync({
        invitedEmail: email.trim(),
        role,
      });
      setFreshInvite({ url: inviteUrl(rawToken) });
      setCopied(false);
      setEmail("");
      toast("Invite created", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t create that invite — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyFreshInvite() {
    if (!freshInvite) return;
    try {
      await navigator.clipboard.writeText(freshInvite.url);
      setCopied(true);
    } catch {
      toast("Couldn’t copy — select and copy the link manually.");
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          People
        </h2>
        {isOwner && !open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <UserPlus className="size-3.5" />
            Invite
          </Button>
        ) : null}
      </div>

      {open ? (
        <form
          onSubmit={handleInvite}
          className="mb-4 space-y-3 rounded-card border border-line bg-bg-2/50 p-3"
        >
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborator@studio.com"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as CollaboratorRole)}
              className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {COLLABORATOR_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Create invite"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setFreshInvite(null);
              }}
            >
              Close
            </Button>
          </div>
        </form>
      ) : null}

      {freshInvite ? (
        <div className="mb-4 rounded-card border border-ice/40 bg-ice/5 p-3">
          <p className="text-xs text-text-lo">
            Copy this link now — TEMPO only shows it once. Send it to the invited email.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-input border border-line bg-bg-2 px-2 py-1.5 font-mono text-xs text-text-hi">
              {freshInvite.url}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyFreshInvite()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] text-text-lo hover:text-text-hi"
            onClick={() => setFreshInvite(null)}
          >
            Done
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        <li className="rounded-card border border-line bg-bg-2/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-text-hi">
              {ownerUserId === user?.id ? "You" : "Owner"}
            </span>
            <span className="rounded-chip bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">
              Owner
            </span>
          </div>
        </li>

        {isLoading ? (
          <li className="h-12 animate-pulse rounded-card bg-bg-2" />
        ) : active.length === 0 ? (
          <li className="py-3 text-center text-sm text-text-lo">
            No collaborators yet. Invite someone to get a second set of ears.
          </li>
        ) : (
          active.map((c) => (
            <CollaboratorRow
              key={c.id}
              collaborator={c}
              isOwner={isOwner}
              isMe={c.user_id === user?.id}
              confirmRevoke={confirmRevokeId === c.id}
              onRequestRevoke={() => setConfirmRevokeId(c.id)}
              onCancelRevoke={() => setConfirmRevokeId(null)}
              onRevoke={async () => {
                try {
                  await revoke.mutateAsync(c.id);
                  setConfirmRevokeId(null);
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Couldn’t revoke that invite.");
                }
              }}
              onChangeRole={async (nextRole) => {
                try {
                  await changeRole.mutateAsync({ id: c.id, role: nextRole });
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Couldn’t change that role.");
                }
              }}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function CollaboratorRow({
  collaborator,
  isOwner,
  isMe,
  confirmRevoke,
  onRequestRevoke,
  onCancelRevoke,
  onRevoke,
  onChangeRole,
}: {
  collaborator: TrackCollaborator;
  isOwner: boolean;
  isMe: boolean;
  confirmRevoke: boolean;
  onRequestRevoke: () => void;
  onCancelRevoke: () => void;
  onRevoke: () => Promise<void>;
  onChangeRole: (role: CollaboratorRole) => Promise<void>;
}) {
  const label = collaborator.invited_email ?? "Invited collaborator";
  const pending = collaborator.status === "pending";

  return (
    <li className="rounded-card border border-line bg-bg-2/40 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm text-text-hi">
              {isMe ? "You" : label}
            </span>
            <span
              className={cn(
                "rounded-chip px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                pending ? "bg-text-lo/15 text-text-lo" : "bg-ok/15 text-ok"
              )}
            >
              {pending ? "pending" : "active"}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-text-lo">
            invited {formatShortDate(collaborator.created_at)}
            {collaborator.accepted_at
              ? ` · accepted ${formatShortDate(collaborator.accepted_at)}`
              : ""}
          </p>
        </div>

        {isOwner ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <select
              value={collaborator.role}
              onChange={(e) => void onChangeRole(e.target.value as CollaboratorRole)}
              className="h-7 rounded-input border border-line bg-bg-2 px-1.5 text-[11px] text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {COLLABORATOR_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {confirmRevoke ? (
              <span className="flex items-center gap-1 text-[11px]">
                <span className="text-warn">Revoke?</span>
                <button
                  type="button"
                  className="text-warn hover:underline"
                  onClick={() => void onRevoke()}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="text-text-lo hover:text-text-hi"
                  onClick={onCancelRevoke}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="rounded-input px-2 py-1 text-[11px] text-text-lo hover:bg-bg-1 hover:text-warn"
                onClick={onRequestRevoke}
              >
                Revoke
              </button>
            )}
          </div>
        ) : (
          <span className="shrink-0 rounded-chip bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-lo">
            {roleLabel(collaborator.role)}
          </span>
        )}
      </div>
    </li>
  );
}
