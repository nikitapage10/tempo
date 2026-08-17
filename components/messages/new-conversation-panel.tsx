"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useMessageMutations } from "@/hooks/use-messages";
import { searchArtistProfiles, type ProfileSearchResult } from "@/lib/api/artist-profile";
import { canDmProfile } from "@/lib/api/messages";
import { suggestedGroupTitle } from "@/lib/messages/behavior";
import { cn } from "@/lib/utils";

/**
 * Recipient picker for a fresh direct message or artist group chat. Lives in
 * both the header message menu and the Messages page.
 */
export function NewConversationPanel({
  myProfileId,
  onStarted,
  compact = false,
}: {
  myProfileId: string | null;
  /** Fired with the conversation id once the thread exists. */
  onStarted: (conversationId: string) => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const { startDm, startGroup } = useMessageMutations(myProfileId);
  const [mode, setMode] = React.useState<"direct" | "group">("direct");
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ProfileSearchResult[]>([]);
  const [groupTitle, setGroupTitle] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 200);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["profile-search", debounced, myProfileId],
    queryFn: () => searchArtistProfiles(debounced, { excludeProfileId: myProfileId }),
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });
  const selectedIds = new Set(selected.map((person) => person.id));
  const visibleResults = results.filter((person) => !selectedIds.has(person.id));

  function reset() {
    setTerm("");
    setSelected([]);
    setGroupTitle("");
  }

  async function startDirect(profileId: string, name: string) {
    setBusyId(profileId);
    try {
      if (!(await canDmProfile(profileId))) {
        toast(`${name} isn’t accepting messages right now.`);
        return;
      }
      const conversationId = await startDm.mutateAsync(profileId);
      reset();
      onStarted(conversationId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t start that conversation.");
    } finally {
      setBusyId(null);
    }
  }

  async function addToGroup(person: ProfileSearchResult) {
    if (selected.length >= 19) {
      toast("Groups can have up to 20 people.");
      return;
    }
    setBusyId(person.id);
    try {
      if (!(await canDmProfile(person.id))) {
        toast(`${person.display_name} isn’t accepting messages right now.`);
        return;
      }
      setSelected((current) => current.some((item) => item.id === person.id) ? current : [...current, person]);
      setTerm("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t add that artist.");
    } finally {
      setBusyId(null);
    }
  }

  async function createGroup() {
    if (!selected.length) {
      toast("Add at least one other artist.");
      return;
    }
    setCreating(true);
    try {
      const conversationId = await startGroup.mutateAsync({
        memberProfileIds: selected.map((person) => person.id),
        title: groupTitle.trim() || suggestedGroupTitle(selected.map((person) => person.display_name)),
      });
      reset();
      onStarted(conversationId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t start that group.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={cn("space-y-2", compact ? "p-3" : "p-4")}>
      <div className="flex rounded-input border border-line bg-bg-1 p-1">
        <button type="button" onClick={() => setMode("direct")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs", mode === "direct" ? "bg-ice text-bg-0" : "text-text-lo")}>
          Direct
        </button>
        <button type="button" onClick={() => setMode("group")} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs", mode === "group" ? "bg-ice text-bg-0" : "text-text-lo")}>
          Group chat
        </button>
      </div>

      {mode === "group" ? (
        <Input
          value={groupTitle}
          onChange={(event) => setGroupTitle(event.target.value.slice(0, 80))}
          placeholder="Group name (optional)"
          aria-label="Group name"
        />
      ) : null}

      {mode === "group" && selected.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <li key={person.id}>
              <span className="inline-flex items-center gap-1.5 rounded-chip border border-line bg-bg-2 py-1 pl-1 pr-1.5">
                <ArtistMark emblemUrl={person.emblem_url} paletteId={person.palette_id} iceColor={person.ice_color} amberColor={person.amber_color} name={person.display_name} size={14} className="size-5" />
                <span className="max-w-[8rem] truncate text-xs text-text-hi">{person.display_name}</span>
                <button type="button" aria-label={`Remove ${person.display_name}`} onClick={() => setSelected((current) => current.filter((item) => item.id !== person.id))} className="text-text-lo hover:text-text-hi">
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={mode === "group" ? "Add artists by name or @handle…" : "Search artists by name or @handle…"}
          aria-label={mode === "group" ? "Search artists to add" : "Search artists to message"}
          className="pl-8"
        />
      </div>

      {debounced.trim().length < 2 ? (
        <p className="px-1 py-2 text-xs leading-relaxed text-text-lo">
          {mode === "group"
            ? "Type at least two characters, add people, then start the group."
            : "Type at least two characters to find anyone on the TEMPO network."}
        </p>
      ) : isFetching && !visibleResults.length ? (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-text-lo">
          <Loader2 className="size-3.5 animate-spin" />
          Searching…
        </p>
      ) : visibleResults.length ? (
        <ul className={cn("overflow-y-auto", compact ? "max-h-44" : "max-h-64")}>
          {visibleResults.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={busyId !== null || creating}
                onClick={() => void (mode === "group" ? addToGroup(person) : startDirect(person.id, person.display_name))}
                className="flex w-full items-center gap-2.5 rounded-input px-2 py-2 text-left transition-colors hover:bg-bg-2 disabled:opacity-60"
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
                    {person.handle ? `@${person.handle}` : person.tagline ?? "On the network"}
                  </p>
                </div>
                {busyId === person.id ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-ice" />
                ) : mode === "group" ? (
                  <Users className="size-3.5 shrink-0 text-text-lo" />
                ) : (
                  <UserPlus className="size-3.5 shrink-0 text-text-lo" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-xs leading-relaxed text-text-lo">
          No artists match that. They may be off the network, or the handle is spelled differently.
        </p>
      )}

      {mode === "group" ? (
        <Button type="button" className="w-full" disabled={creating || selected.length < 1} onClick={() => void createGroup()}>
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
          {selected.length < 1 ? "Add people to start a group" : `Start group · ${selected.length + 1} people`}
        </Button>
      ) : null}
    </div>
  );
}
