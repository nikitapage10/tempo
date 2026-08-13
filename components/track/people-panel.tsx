"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Search, UserPlus } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { useActiveArtist } from "@/components/active-artist-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useCollaboratorMutations, useCollaborators } from "@/hooks/use-collaborators";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFollowing } from "@/hooks/use-follows";
import { searchArtistProfiles } from "@/lib/api/artist-profile";
import { inviteUrl, normalizeCollaboratorHandle } from "@/lib/api/collaborators";
import { requestArtistInvite } from "@/lib/api/artist-invite-requests";
import { COLLABORATOR_ROLES } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type { CollaboratorRole, TrackCollaborator } from "@/lib/types";
import { cn } from "@/lib/utils";

type PeoplePanelProps = {
  trackId: string;
  ownerUserId: string;
  isOwner: boolean;
};

type InviteMode = "artist" | "email";

function roleLabel(role: CollaboratorRole): string {
  return COLLABORATOR_ROLES.find((r) => r.value === role)?.label ?? role;
}

function collaboratorLabel(collaborator: TrackCollaborator, isMe: boolean): string {
  if (isMe) return "You";
  if (collaborator.display_name) return collaborator.display_name;
  if (collaborator.handle) return `@${collaborator.handle}`;
  return collaborator.invited_email ?? "Invited collaborator";
}

export function PeoplePanel({ trackId, ownerUserId, isOwner }: PeoplePanelProps) {
  const user = useCurrentUser();
  const { activeArtist } = useActiveArtist();
  const { profile: myProfile } = useArtistProfile(activeArtist?.id ?? null);
  const followingQuery = useFollowing(myProfile?.id ?? null);
  const { data: collaborators = [], isLoading } = useCollaborators(trackId);
  const { includeArtist, invite, revoke, changeRole } = useCollaboratorMutations(trackId);
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<InviteMode>("artist");
  const [email, setEmail] = React.useState("");
  const [handleQuery, setHandleQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [role, setRole] = React.useState<CollaboratorRole>("commenter");
  const [busy, setBusy] = React.useState(false);
  const [freshInvite, setFreshInvite] = React.useState<{ url: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = React.useState<string | null>(null);
  const [requestArtist, setRequestArtist] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(handleQuery), 200);
    return () => window.clearTimeout(timer);
  }, [handleQuery]);

  const searchTerm = normalizeCollaboratorHandle(debouncedQuery);
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["profile-search", "collaborator", searchTerm, myProfile?.id],
    queryFn: () =>
      searchArtistProfiles(searchTerm, { excludeProfileId: myProfile?.id, limit: 8 }),
    enabled: open && mode === "artist" && searchTerm.length >= 2,
    staleTime: 30_000,
  });

  const active = collaborators.filter((c) => c.status !== "revoked");
  const takenHandles = new Set(
    active
      .map((c) => c.handle?.toLowerCase())
      .filter((handle): handle is string => !!handle)
  );
  const following = (followingQuery.data ?? [])
    .map((row) => row.profile)
    .filter((profile): profile is NonNullable<typeof profile> => !!profile?.handle)
    .filter((profile) => profile.id !== myProfile?.id);

  async function addArtist(input: { profileId?: string; handle?: string }) {
    setBusy(true);
    try {
      await includeArtist.mutateAsync({ ...input, role });
      toast("They’re on this track.", "ok");
      setHandleQuery("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add that artist — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { rawToken } = await invite.mutateAsync({
        invitedEmail: email.trim(),
        role,
      });
      const invitedEmail = email.trim();
      setFreshInvite({ url: inviteUrl(rawToken) });
      setCopied(false);
      setEmail("");
      if (requestArtist) {
        try {
          await requestArtistInvite({
            email: invitedEmail,
            trackId,
            artistId: activeArtist?.id,
            note: `Collaborator on this track (${role}).`,
          });
          toast("Invite created. TEMPO will review the artist invite before it goes out.", "ok");
        } catch (requestErr) {
          toast(
            requestErr instanceof Error
              ? requestErr.message
              : "Collaborator invite is ready — the artist invite still needs to be requested."
          );
        }
        setRequestArtist(false);
      } else {
        toast("Invite created", "ok");
      }
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
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          People
        </h2>
        {isOwner && !open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <UserPlus className="size-3.5" />
            Add
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="mb-4 space-y-3 rounded-card border border-line bg-bg-2/50 p-3">
          <div className="flex gap-1 rounded-input border border-line bg-bg-1 p-0.5">
            {(
              [
                ["artist", "TEMPO artist"],
                ["email", "Invite by email"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex-1 rounded-[7px] px-2 py-1.5 text-xs font-medium transition-colors",
                  mode === id ? "bg-bg-2 text-text-hi" : "text-text-lo hover:text-text-hi"
                )}
              >
                {label}
              </button>
            ))}
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

          {mode === "artist" ? (
            <div className="space-y-2">
              <Label htmlFor="invite-handle">Artist</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
                <Input
                  id="invite-handle"
                  value={handleQuery}
                  onChange={(e) => setHandleQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const handle = normalizeCollaboratorHandle(handleQuery);
                      if (handle) void addArtist({ handle });
                    }
                  }}
                  placeholder="Name or @handle"
                  className="pl-8"
                />
              </div>
              <p className="text-xs leading-relaxed text-text-lo">
                Include someone already on TEMPO — people you follow, or anyone you can find by handle. They get this track, not your whole catalog.
              </p>
              {searchTerm.length >= 2 ? (
                searching && searchResults.length === 0 ? (
                  <p className="flex items-center gap-2 text-xs text-text-lo">
                    <Loader2 className="size-3.5 animate-spin" />
                    Searching…
                  </p>
                ) : searchResults.length ? (
                  <ArtistPickList
                    people={searchResults}
                    takenHandles={takenHandles}
                    busy={busy}
                    onPick={(profileId) => void addArtist({ profileId })}
                  />
                ) : (
                  <p className="text-xs text-text-lo">
                    No one matched. Check the handle, or invite them by email instead.
                  </p>
                )
              ) : following.length ? (
                <div className="space-y-1.5">
                  <p className="label-mono text-text-lo">People you follow</p>
                  <ArtistPickList
                    people={following}
                    takenHandles={takenHandles}
                    busy={busy}
                    onPick={(profileId) => void addArtist({ profileId })}
                  />
                </div>
              ) : (
                <p className="text-xs text-text-lo">
                  Type a handle to find anyone on the network.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleEmailInvite} className="space-y-3">
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
              <p className="text-xs leading-relaxed text-text-lo">
                A guest link lets someone comment with no account. This invite gives them a simple collaborator login on this track. Asking TEMPO to invite them as a full artist needs approval during beta.
              </p>
              <label className="flex items-start gap-2 text-xs text-text-hi">
                <input
                  type="checkbox"
                  checked={requestArtist}
                  onChange={(e) => setRequestArtist(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Also ask TEMPO to invite them as a full artist (needs approval)</span>
              </label>
              <Button type="submit" size="sm" disabled={busy || !email.trim()}>
                {busy ? "Sending…" : "Create invite"}
              </Button>
            </form>
          )}

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
            className="mt-2 text-xs text-text-lo hover:text-text-hi"
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
            <span className="rounded-chip bg-amber/15 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber">
              Owner
            </span>
          </div>
        </li>

        {isLoading ? (
          <li className="h-12 animate-pulse rounded-card bg-bg-2" />
        ) : active.length === 0 ? (
          <li className="py-3 text-center text-sm text-text-lo">
            No collaborators yet. Include a TEMPO artist or invite someone by email.
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

function ArtistPickList({
  people,
  takenHandles,
  busy,
  onPick,
}: {
  people: {
    id: string;
    handle: string | null;
    display_name: string;
    emblem_url: string | null;
    palette_id?: string | null;
    ice_color?: string | null;
    amber_color?: string | null;
  }[];
  takenHandles: Set<string>;
  busy: boolean;
  onPick: (profileId: string) => void;
}) {
  return (
    <ul className="max-h-56 overflow-y-auto">
      {people.map((person) => {
        const taken = !!person.handle && takenHandles.has(person.handle.toLowerCase());
        return (
          <li key={person.id}>
            <button
              type="button"
              disabled={busy || taken}
              onClick={() => onPick(person.id)}
              className="flex w-full items-center gap-2.5 rounded-input px-2 py-2 text-left transition-colors hover:bg-bg-1 disabled:opacity-60"
            >
              <ArtistMark
                emblemUrl={person.emblem_url}
                paletteId={person.palette_id}
                iceColor={person.ice_color}
                amberColor={person.amber_color}
                name={person.display_name}
                size={18}
                className="size-7"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-hi">{person.display_name}</p>
                <p className="truncate text-xs text-text-lo">
                  {person.handle ? `@${person.handle}` : "On the network"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-ice">
                {taken ? "On track" : "Include"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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
  const label = collaboratorLabel(collaborator, isMe);
  const pending = collaborator.status === "pending";

  return (
    <li className="rounded-card border border-line bg-bg-2/40 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm text-text-hi">{label}</span>
            {collaborator.handle && !isMe ? (
              <span className="truncate font-mono text-[11px] text-text-lo">
                @{collaborator.handle}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-chip px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
                pending ? "bg-text-lo/15 text-text-lo" : "bg-ok/15 text-ok"
              )}
            >
              {pending ? "pending" : "active"}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-text-lo">
            {collaborator.user_id && !pending ? "included" : "invited"}{" "}
            {formatShortDate(collaborator.created_at)}
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
              className="h-7 rounded-input border border-line bg-bg-2 px-1.5 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {COLLABORATOR_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {confirmRevoke ? (
              <span className="flex items-center gap-1 text-xs">
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
                className="rounded-input px-2 py-1 text-xs text-text-lo hover:bg-bg-1 hover:text-warn"
                onClick={onRequestRevoke}
              >
                Revoke
              </button>
            )}
          </div>
        ) : (
          <span className="shrink-0 rounded-chip bg-bg-2 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-text-lo">
            {roleLabel(collaborator.role)}
          </span>
        )}
      </div>
    </li>
  );
}
