"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, X } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useMyTeamRequests, useTeamRequestMutations } from "@/hooks/use-team-requests";
import { searchArtistProfiles, type ProfileSearchResult } from "@/lib/api/artist-profile";
import { MEMBER_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type MemberRole } from "@/lib/team/roles";
import { errorMessage } from "@/lib/utils";

const STATUS_COPY = {
  pending: "Waiting on artist",
  invited: "Invitation ready — review it above",
  declined: "Artist passed",
  cancelled: "Cancelled",
} as const;

/** Pro-side discovery and outbound requests, shown above the existing roster. */
export function ProTeamRequests() {
  const { toast } = useToast();
  const requests = useMyTeamRequests();
  const mutations = useTeamRequestMutations();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [picked, setPicked] = React.useState<ProfileSearchResult | null>(null);
  const [role, setRole] = React.useState<MemberRole>("manager");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: ["profile-search", "team-request", debounced],
    queryFn: () => searchArtistProfiles(debounced, { limit: 8, profileKind: "artist" }),
    enabled: !picked && debounced.length >= 2,
    staleTime: 30_000,
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!picked) return;
    try {
      await mutations.create.mutateAsync({ artistId: picked.artist_id, role, note });
      toast(`Request sent to ${picked.display_name}.`, "ok");
      setPicked(null);
      setQuery("");
      setRole("manager");
      setNote("");
    } catch (error) {
      toast(errorMessage(error, "Couldn’t send that request."));
    }
  }

  async function cancel(id: string) {
    try {
      await mutations.cancel.mutateAsync(id);
      toast("Request cancelled.", "ok");
    } catch (error) {
      toast(errorMessage(error, "Couldn’t cancel that request."));
    }
  }

  return (
    <section className="panel space-y-4 p-4 sm:p-5">
      <div>
        <p className="label-mono text-ice">Grow your roster</p>
        <h2 className="mt-1 font-display text-lg text-text-hi">Request to join an artist team</h2>
        <p className="mt-1 text-sm text-text-lo">
          Find a published artist, choose the role you’re offering, and introduce yourself.
          The artist decides the access and sends an invitation for your final review.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label-mono mb-1 block" htmlFor="artist-team-search">Artist name or handle</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
            <Input
              id="artist-team-search"
              value={picked ? `${picked.display_name} (@${picked.handle})` : query}
              onChange={(event) => { setPicked(null); setQuery(event.target.value); }}
              placeholder="Search artists on TEMPO"
              autoComplete="off"
              className="pl-9"
            />
          </div>
          {!picked && debounced.length >= 2 ? (
            <div className="mt-2 space-y-1.5">
              {search.isFetching ? <p className="text-xs text-text-lo">Looking for artists…</p> : null}
              {!search.isFetching && (search.data ?? []).length === 0 ? (
                <p className="text-xs text-text-lo">No published artists matched that search.</p>
              ) : null}
              {(search.data ?? []).map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => { setPicked(profile); setQuery(profile.handle ?? profile.display_name); }}
                  className="well flex w-full items-center gap-3 rounded-input px-3 py-2 text-left transition-colors duration-hover hover:bg-bg-2/80"
                >
                  <ArtistMark emblemUrl={profile.emblem_url} paletteId={profile.palette_id} iceColor={profile.ice_color} amberColor={profile.amber_color} name={profile.display_name} size={32} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-hi">{profile.display_name}</span>
                    <span className="block truncate text-xs text-text-lo">@{profile.handle}{profile.tagline ? ` · ${profile.tagline}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {picked ? (
          <div className="panel-quiet grid gap-3 p-3 sm:grid-cols-2">
            <div>
              <label className="label-mono mb-1 block" htmlFor="requested-team-role">Requested role</label>
              <select
                id="requested-team-role"
                value={role}
                onChange={(event) => setRole(event.target.value as MemberRole)}
                className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {MEMBER_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
              </select>
              <p className="mt-1 text-xs text-text-lo">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <div>
              <label className="label-mono mb-1 block" htmlFor="artist-team-note">A note to the artist</label>
              <Textarea id="artist-team-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Why you’d like to work together" />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => { setPicked(null); setQuery(""); }}><X className="size-3.5" />Clear</Button>
              <Button type="submit" disabled={mutations.create.isPending}><Send className="size-3.5" />{mutations.create.isPending ? "Sending…" : "Send request"}</Button>
            </div>
          </div>
        ) : null}
      </form>

      {(requests.data ?? []).length > 0 ? (
        <div className="border-t border-line/60 pt-4">
          <p className="label-mono mb-2">Your requests</p>
          <ul className="space-y-2">
            {(requests.data ?? []).map((item) => (
              <li key={item.id} className="well flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <ArtistMark emblemUrl={item.artist?.emblem_url ?? null} paletteId={item.artist?.palette_id} iceColor={item.artist?.ice_color} amberColor={item.artist?.amber_color} name={item.artist?.display_name ?? "Artist"} size={32} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-hi">{item.artist?.display_name ?? "Artist"}</p>
                  <p className="text-xs text-text-lo">{ROLE_LABELS[item.requestedRole]} · {STATUS_COPY[item.status]}</p>
                </div>
                {item.status === "pending" ? <Button type="button" size="sm" variant="ghost" disabled={mutations.cancel.isPending} onClick={() => void cancel(item.id)}>Cancel request</Button> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
