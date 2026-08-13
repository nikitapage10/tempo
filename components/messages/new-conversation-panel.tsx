"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useMessageMutations } from "@/hooks/use-messages";
import { searchArtistProfiles } from "@/lib/api/artist-profile";
import { canDmProfile } from "@/lib/api/messages";
import { cn } from "@/lib/utils";

/**
 * Recipient picker for starting a fresh direct message. Lives in both the
 * header message menu and the Messages page so a conversation no longer has to
 * begin from someone's profile page.
 */
export function NewConversationPanel({
  myProfileId,
  onStarted,
  compact = false,
}: {
  myProfileId: string | null;
  /** Fired with the conversation id once the DM exists. */
  onStarted: (conversationId: string) => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const { startDm } = useMessageMutations(myProfileId);
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

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

  async function start(profileId: string, name: string) {
    setBusyId(profileId);
    try {
      // The same rule the profile page enforces — someone can be findable on
      // the network but still have DMs closed.
      if (!(await canDmProfile(profileId))) {
        toast(`${name} isn’t accepting messages right now.`);
        return;
      }
      const conversationId = await startDm.mutateAsync(profileId);
      setTerm("");
      onStarted(conversationId);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t start that conversation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={cn("space-y-2", compact ? "p-3" : "p-4")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search artists by name or @handle…"
          aria-label="Search artists to message"
          className="pl-8"
        />
      </div>

      {debounced.trim().length < 2 ? (
        <p className="px-1 py-2 text-xs leading-relaxed text-text-lo">
          Type at least two characters to find anyone on the TEMPO network.
        </p>
      ) : isFetching && !results.length ? (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-text-lo">
          <Loader2 className="size-3.5 animate-spin" />
          Searching…
        </p>
      ) : results.length ? (
        <ul className={cn("overflow-y-auto", compact ? "max-h-56" : "max-h-72")}>
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void start(person.id, person.display_name)}
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
    </div>
  );
}
