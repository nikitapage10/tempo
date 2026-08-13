"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { QuietEmpty } from "@/components/ui/section-header";
import { useArtistMemberMutations, useArtistMembers } from "@/hooks/use-artist-members";
import { searchArtistProfiles, type ProfileSearchResult } from "@/lib/api/artist-profile";
import { teamInviteUrl, type ArtistMember } from "@/lib/api/artist-members";
import {
  AREA_DESCRIPTIONS,
  AREA_KEYS,
  AREA_LABELS,
  type AreaGrants,
  type AreaLevel,
} from "@/lib/team/areas";
import {
  MEMBER_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isCustomizedFromRole,
  presetForRole,
  type MemberRole,
} from "@/lib/team/roles";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<AreaLevel, string> = { none: "None", read: "Read", write: "Write" };

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** The owner's side of the team page — invite, edit grants, revoke. */
export function TeamManager({ artistId }: { artistId: string }) {
  const { data: members, isLoading } = useArtistMembers(artistId);
  const mutations = useArtistMemberMutations(artistId);
  const { toast } = useToast();

  const [inviting, setInviting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [picked, setPicked] = React.useState<ProfileSearchResult | null>(null);
  const [role, setRole] = React.useState<MemberRole>("manager");
  const [lastInviteUrl, setLastInviteUrl] = React.useState<string | null>(null);
  const [lastEmailSent, setLastEmailSent] = React.useState<boolean | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const searchTerm = looksLikeEmail(debounced) ? "" : normalizeHandle(debounced);
  const searchQuery = useQuery({
    queryKey: ["profile-search", "team", searchTerm],
    queryFn: () => searchArtistProfiles(searchTerm, { limit: 8 }),
    enabled: inviting && searchTerm.length >= 2,
    staleTime: 30_000,
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = looksLikeEmail(query) ? query.trim() : "";
    const handle = picked?.handle || (!email ? normalizeHandle(query) : "");
    if (!email && !handle && !picked) return;
    try {
      const result = await mutations.invite.mutateAsync({
        artistId,
        role,
        invitedEmail: email || undefined,
        handle: picked ? undefined : handle || undefined,
        profileId: picked?.id,
      });
      if (result.kind === "existing") {
        setLastInviteUrl(null);
        setLastEmailSent(null);
        toast("Invite sent — they’ll get a notification to approve.", "ok");
      } else {
        setLastInviteUrl(result.rawToken ? teamInviteUrl(result.rawToken) : null);
        setLastEmailSent(result.emailSent);
        toast(
          result.emailSent
            ? `Invite sent to ${email || handle}.`
            : "Invite created — email delivery isn’t set up, so share the link below instead.",
          result.emailSent ? "ok" : "info"
        );
      }
      setQuery("");
      setPicked(null);
      setInviting(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t send that invite.");
    }
  }

  async function copyInviteUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied.", "ok");
    } catch {
      toast("Couldn’t copy that link — select and copy manually.");
    }
  }

  const active = (members ?? []).filter((m) => m.status !== "revoked");
  const canSubmit = Boolean(picked || query.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-lo">
          Managers, agents, tour managers, and anyone else who needs access without being
          the account holder. Invite someone already on TEMPO by handle or email, or send
          an email to someone new.
        </p>
        <Button type="button" size="sm" onClick={() => setInviting(true)}>
          <Plus className="size-3.5" />
          Invite
        </Button>
      </div>

      {lastInviteUrl ? (
        <div className="panel-quiet flex items-center gap-2 p-3 text-xs">
          {lastEmailSent === false ? (
            <span className="shrink-0 text-amber">No email sent —</span>
          ) : null}
          <span className="min-w-0 flex-1 truncate font-mono text-text-lo">{lastInviteUrl}</span>
          <button
            type="button"
            onClick={() => void copyInviteUrl(lastInviteUrl)}
            className="shrink-0 rounded-input p-1.5 text-ice transition-colors duration-hover hover:bg-ice/10"
            aria-label="Copy invite link"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ) : null}

      {inviting ? (
        <form onSubmit={handleInvite} className="panel-quiet space-y-3 p-4">
          <div>
            <label className="label-mono mb-1 block" htmlFor="team-invite-who">
              Handle or email
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
              <Input
                id="team-invite-who"
                value={picked ? `${picked.display_name} (@${picked.handle})` : query}
                onChange={(e) => {
                  setPicked(null);
                  setQuery(e.target.value);
                }}
                placeholder="@handle or name@example.com"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            {!picked && !looksLikeEmail(query) && searchTerm.length >= 2 ? (
              <div className="mt-2 space-y-1.5">
                {searchQuery.isFetching ? (
                  <p className="text-xs text-text-lo">Looking them up…</p>
                ) : (searchQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-text-lo">
                    No one on TEMPO matched. You can still send this as a handle, or switch
                    to an email.
                  </p>
                ) : (
                  (searchQuery.data ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPicked(p);
                        setQuery(p.handle ?? "");
                      }}
                      className="well flex w-full items-center gap-3 rounded-input px-3 py-2 text-left transition-colors duration-hover hover:bg-bg-2/80"
                    >
                      <ArtistMark
                        emblemUrl={p.emblem_url}
                        paletteId={p.palette_id}
                        iceColor={p.ice_color}
                        amberColor={p.amber_color}
                        name={p.display_name}
                        size={18}
                        className="size-[18px]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-hi">
                          {p.display_name}
                        </span>
                        <span className="block truncate text-xs text-text-lo">@{p.handle}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div>
            <label className="label-mono mb-1 block" htmlFor="team-invite-role">
              Role
            </label>
            <select
              id="team-invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-lo">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setInviting(false);
                setQuery("");
                setPicked(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutations.invite.isPending || !canSubmit}>
              {mutations.invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-panel bg-bg-2/40" />
      ) : active.length === 0 ? (
        <QuietEmpty>
          Nobody else has access to this artist yet. Invite a manager, agent, or tour
          manager to get started.
        </QuietEmpty>
      ) : (
        <ul className="space-y-2">
          {active.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId((prev) => (prev === m.id ? null : m.id))}
              onSetAreas={(areas) => mutations.setAreas.mutate({ id: m.id, areas })}
              onSetRole={(role) => mutations.setRole.mutate({ id: m.id, role })}
              onRevoke={() => mutations.revoke.mutate(m.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function pendingLabel(member: ArtistMember): string {
  if (member.status !== "pending") return "";
  if (member.userId) return " · waiting for them to approve";
  return " · invite pending";
}

function MemberRow({
  member,
  expanded,
  onToggle,
  onSetAreas,
  onSetRole,
  onRevoke,
}: {
  member: ArtistMember;
  expanded: boolean;
  onToggle: () => void;
  onSetAreas: (areas: AreaGrants) => void;
  onSetRole: (role: MemberRole) => void;
  onRevoke: () => void;
}) {
  const customized = isCustomizedFromRole(member.role, member.areas);
  const label = member.invitedEmail ?? "On TEMPO";

  return (
    <li className="well rounded-input p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-hi">{label}</p>
          <p className="text-xs text-text-lo">
            {ROLE_LABELS[member.role]}
            {customized ? " · customised" : ""}
            {pendingLabel(member)}
          </p>
        </div>
        <select
          value={member.role}
          onChange={(e) => onSetRole(e.target.value as MemberRole)}
          className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          {MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-input px-2 py-1 text-xs text-text-lo transition-colors duration-hover hover:text-ice"
        >
          {expanded ? "Hide access" : "Edit access"}
        </button>
        <button
          type="button"
          onClick={onRevoke}
          className="shrink-0 rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
          aria-label={`Revoke ${member.invitedEmail ?? "this member"}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-line/50 pt-3">
          {customized ? (
            <button
              type="button"
              onClick={() => onSetAreas(presetForRole(member.role))}
              className="text-xs text-ice hover:underline"
            >
              Reset to {ROLE_LABELS[member.role]} defaults
            </button>
          ) : null}
          {AREA_KEYS.map((area) => (
            <div key={area} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-text-hi">{AREA_LABELS[area]}</p>
                <p className="text-[11px] text-text-lo">{AREA_DESCRIPTIONS[area]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-chip border border-line p-0.5">
                {(["none", "read", "write"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() =>
                      onSetAreas({
                        ...member.areas,
                        [area]: level === "none" ? undefined : level,
                      })
                    }
                    className={cn(
                      "rounded-chip px-2 py-0.5 text-[11px] transition-colors duration-hover",
                      (member.areas[area] ?? "none") === level
                        ? "bg-bg-2 text-ice"
                        : "text-text-lo hover:text-text-hi"
                    )}
                  >
                    {LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}
