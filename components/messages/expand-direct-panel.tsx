"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useMessageMutations } from "@/hooks/use-messages";
import { searchArtistProfiles } from "@/lib/api/artist-profile";
import { canDmProfile } from "@/lib/api/messages";
import type { Conversation } from "@/lib/types";

/**
 * Turns a 1:1 artist chat into a new group with one more person. The original
 * thread is left alone. History is copied only when asked.
 */
export function ExpandDirectPanel({
  conversation,
  myProfileId,
  onCreated,
  onCancel,
}: {
  conversation: Conversation;
  myProfileId: string | null;
  onCreated: (conversationId: string) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const mutations = useMessageMutations(myProfileId);
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [includeHistory, setIncludeHistory] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 200);
    return () => window.clearTimeout(timer);
  }, [term]);

  const excludeIds = new Set(
    [myProfileId, conversation.peer?.id].filter((id): id is string => Boolean(id)),
  );
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["profile-search", "expand-direct", debounced, myProfileId],
    queryFn: () => searchArtistProfiles(debounced, { excludeProfileId: myProfileId }),
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });
  const addable = results.filter((person) => !excludeIds.has(person.id));

  async function expand(profileId: string, name: string) {
    if (!myProfileId) return;
    setBusyId(profileId);
    try {
      if (!(await canDmProfile(profileId))) {
        toast(`${name} isn’t accepting messages right now.`);
        return;
      }
      const conversationId = await mutations.expandDirect.mutateAsync({
        conversationId: conversation.id,
        memberProfileId: profileId,
        includeHistory,
      });
      toast(includeHistory ? `Started a group with ${name}, including this chat.` : `Started a group with ${name}.`, "ok");
      onCreated(conversationId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t start that group.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-h-64 shrink-0 overflow-y-auto border-b border-line bg-bg-1/90 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-mono">Add someone</p>
          <p className="mt-1 text-xs leading-relaxed text-text-lo">
            Starts a new group with {conversation.peer?.display_name ?? "this artist"}. This 1:1 stays as it is.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-input p-1 text-text-lo hover:text-text-hi" aria-label="Close">
          <X className="size-3.5" />
        </button>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-input border border-line bg-bg-2/50 px-2.5 py-2">
        <input
          type="checkbox"
          checked={includeHistory}
          onChange={(event) => setIncludeHistory(event.target.checked)}
          className="mt-0.5 accent-[rgb(var(--ice-rgb))]"
        />
        <span>
          <span className="block text-xs text-text-hi">Include messages from this chat</span>
          <span className="block text-[11px] text-text-lo">Leave off to start the group empty.</span>
        </span>
      </label>

      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search artists to add…"
          aria-label="Search artists to add to a new group"
          className="pl-8"
        />
      </div>

      {debounced.trim().length < 2 ? (
        <p className="mt-2 text-xs text-text-lo">Type at least two characters to find someone.</p>
      ) : isFetching && !addable.length ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-text-lo"><Loader2 className="size-3.5 animate-spin" />Searching…</p>
      ) : addable.length ? (
        <ul className="mt-1">
          {addable.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void expand(person.id, person.display_name)}
                className="flex w-full items-center gap-2 rounded-input px-1 py-1.5 text-left hover:bg-bg-2 disabled:opacity-60"
              >
                <ArtistMark emblemUrl={person.emblem_url} paletteId={person.palette_id} iceColor={person.ice_color} amberColor={person.amber_color} name={person.display_name} size={16} className="size-6" />
                <span className="min-w-0 flex-1 truncate text-xs text-text-hi">{person.display_name}</span>
                {busyId === person.id ? <Loader2 className="size-3.5 animate-spin text-ice" /> : <UserPlus className="size-3.5 text-text-lo" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-text-lo">No artists match that.</p>
      )}

      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
