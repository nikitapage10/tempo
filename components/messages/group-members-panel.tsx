"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserMinus, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useMessageMutations } from "@/hooks/use-messages";
import { searchArtistProfiles } from "@/lib/api/artist-profile";
import { canDmProfile } from "@/lib/api/messages";
import { conversationMemberLabel } from "@/lib/messages/behavior";
import type { Conversation } from "@/lib/types";

export function GroupMembersPanel({
  conversation,
  myProfileId,
  onLeft,
}: {
  conversation: Conversation;
  myProfileId: string | null;
  onLeft: () => void;
}) {
  const { toast } = useToast();
  const mutations = useMessageMutations(myProfileId);
  const isAdmin = conversation.my_role === "admin";
  const [title, setTitle] = React.useState(conversation.title ?? "");
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTitle(conversation.title ?? "");
  }, [conversation.id, conversation.title]);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 200);
    return () => window.clearTimeout(timer);
  }, [term]);

  const memberIds = new Set((conversation.members ?? []).map((member) => member.id));
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["profile-search", "group-add", debounced, myProfileId],
    queryFn: () => searchArtistProfiles(debounced, { excludeProfileId: myProfileId }),
    enabled: isAdmin && debounced.trim().length >= 2,
    staleTime: 30_000,
  });
  const addable = results.filter((person) => !memberIds.has(person.id));

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === (conversation.title ?? "").trim()) return;
    try {
      await mutations.renameGroup.mutateAsync({ conversationId: conversation.id, title: next });
      toast("Group renamed.", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t rename that group.");
    }
  }

  async function addMember(profileId: string, name: string) {
    if (!myProfileId) return;
    setBusyId(profileId);
    try {
      if (!(await canDmProfile(profileId))) {
        toast(`${name} isn’t accepting messages right now.`);
        return;
      }
      await mutations.addGroupMembers.mutateAsync({ conversationId: conversation.id, memberProfileIds: [profileId] });
      setTerm("");
      toast(`Added ${name}.`, "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t add that artist.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(profileId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this group?`)) return;
    try {
      await mutations.removeGroupMember.mutateAsync({ conversationId: conversation.id, profileId });
      toast(`${name} left the group.`, "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t remove that artist.");
    }
  }

  async function leave() {
    if (!window.confirm("Leave this group? You won’t see new messages unless someone adds you again.")) return;
    try {
      await mutations.leaveGroup.mutateAsync(conversation.id);
      toast("You left the group.", "ok");
      onLeft();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t leave that group.");
    }
  }

  const names = (conversation.members ?? []).map((member) => member.display_name);

  return (
    <div className="max-h-64 shrink-0 overflow-y-auto border-b border-line bg-bg-1/90 p-3">
      <p className="label-mono">{conversationMemberLabel(names)} · {(conversation.members ?? []).length} people</p>
      {isAdmin ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveTitle();
          }}
        >
          <Input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 80))} aria-label="Group name" placeholder="Group name" />
          <Button type="submit" size="sm" variant="secondary" disabled={mutations.renameGroup.isPending || !title.trim()}>
            Save
          </Button>
        </form>
      ) : null}

      <ul className="mt-2 space-y-1">
        {(conversation.members ?? []).map((member) => {
          const mine = Boolean(myProfileId && member.id === myProfileId);
          return (
            <li key={member.id} className="flex items-center gap-2 rounded-input px-1 py-1">
              <ArtistMark emblemUrl={member.emblem_url} paletteId={member.palette_id} iceColor={member.ice_color} amberColor={member.amber_color} name={member.display_name} size={16} className="size-6" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-hi">{member.display_name}{mine ? " (you)" : ""}</p>
                {member.handle ? <p className="truncate text-[11px] text-text-lo">@{member.handle}</p> : null}
              </div>
              {isAdmin && !mine ? (
                <button type="button" aria-label={`Remove ${member.display_name}`} onClick={() => void removeMember(member.id, member.display_name)} className="rounded-input p-1 text-text-lo hover:text-warn">
                  <UserMinus className="size-3.5" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isAdmin ? (
        <div className="mt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Add an artist…" aria-label="Add an artist to this group" className="pl-8" />
          </div>
          {debounced.trim().length >= 2 ? (
            isFetching && !addable.length ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-text-lo"><Loader2 className="size-3.5 animate-spin" />Searching…</p>
            ) : addable.length ? (
              <ul className="mt-1">
                {addable.map((person) => (
                  <li key={person.id}>
                    <button type="button" disabled={busyId !== null} onClick={() => void addMember(person.id, person.display_name)} className="flex w-full items-center gap-2 rounded-input px-1 py-1.5 text-left hover:bg-bg-2 disabled:opacity-60">
                      <ArtistMark emblemUrl={person.emblem_url} paletteId={person.palette_id} iceColor={person.ice_color} amberColor={person.amber_color} name={person.display_name} size={16} className="size-6" />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-hi">{person.display_name}</span>
                      {busyId === person.id ? <Loader2 className="size-3.5 animate-spin text-ice" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-text-lo">No artists match that.</p>
            )
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" variant="ghost" className="text-warn hover:text-warn" onClick={() => void leave()} disabled={mutations.leaveGroup.isPending}>
          <X className="size-3.5" />Leave group
        </Button>
      </div>
    </div>
  );
}
