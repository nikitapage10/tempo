"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, MessageSquare, Search, Users } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { usePeople, useRecentlyActiveProfiles } from "@/hooks/use-people";
import { useFollowers, useFollowing } from "@/hooks/use-follows";
import { useHomeTimeline, useFeedMutations } from "@/hooks/use-feed";
import { searchArtistProfiles } from "@/lib/api/people";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ContactSheet } from "@/components/social/contact-sheet";
import { InviteArtistFriend } from "@/components/social/invite-artist-friend";
import { ConnectionGlobe } from "@/components/social/connection-globe";
import type { GlobePerson } from "@/components/social/connection-globe";
import { FeedComposer } from "@/components/social/feed-composer";
import { FeedPostCard } from "@/components/social/feed-post";
import { PostDetailDialog } from "@/components/social/post-detail";
import { Top8Rail } from "@/components/social/top8-rail";
import type { Top8Candidate } from "@/components/social/top8-rail";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { resolveArtistAccent } from "@/lib/artist-theme";
import { resolveLocation } from "@/lib/geo";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DemoSocialView } from "@/components/demo/demo-social-view";
import { PersonBadges } from "@/components/social/person-badges";
import { fetchNetworkPersonBadges } from "@/lib/api/network-badges";
import { useQuery } from "@tanstack/react-query";

type Tab = "top8" | "following" | "discover";

function activityLabel(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(elapsed / 86_400_000));
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days} days ago`;
  if (days < 35) return `Active ${Math.floor(days / 7)}w ago`;
  return "Recently active";
}

export default function SocialView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { socialArtistId, mode } = useWorkspaceMode();
  const authorArtistId = socialArtistId ?? (mode === "artist" ? activeArtist?.id ?? null : null);
  const { profile, isLoading: profileLoading, publish, save } = useArtistProfile(
    authorArtistId
  );
  const myProfileId = profile?.id ?? null;
  const onNetwork =
    profile?.visibility === "members" || profile?.visibility === "public";
  // A private artist has not joined Social yet. Keep follows and feed data
  // out of the UI until they explicitly opt into the network.
  const socialDataProfileId = onNetwork ? myProfileId : null;
  const { ice: accentIce, amber: accentAmber } = resolveArtistAccent(
    activeArtist?.palette_id,
    { ice: activeArtist?.ice_color, amber: activeArtist?.amber_color }
  );

  const [tab, setTab] = React.useState<Tab>("top8");
  const [discoverQ, setDiscoverQ] = React.useState("");
  const [discoverResults, setDiscoverResults] = React.useState<
    Awaited<ReturnType<typeof searchArtistProfiles>>
  >([]);
  const [contact, setContact] = React.useState<Person | null>(null);
  const [postId, setPostId] = React.useState<string | null>(
    searchParams.get("post")
  );

  const { data: allPeople = [] } = usePeople({});
  const { data: activeProfiles = [] } = useRecentlyActiveProfiles(
    onNetwork ? myProfileId : null
  );
  const uniquePeople = React.useMemo(() => {
    const seen = new Set<string>();
    const out: typeof activeProfiles = [];
    for (const person of activeProfiles) {
      const key = person.owner_user_id || person.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(person);
    }
    return out;
  }, [activeProfiles]);
  const ownerIds = React.useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const person of uniquePeople) {
      const id = person.owner_user_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [uniquePeople]);
  const badgesQuery = useQuery({
    queryKey: ["network-badges", ownerIds.slice().sort()],
    queryFn: () => fetchNetworkPersonBadges(ownerIds),
    enabled: ownerIds.length > 0 && onNetwork,
    staleTime: 60_000,
  });
  const { data: following = [] } = useFollowing(socialDataProfileId);
  const { data: followers = [] } = useFollowers(onNetwork ? myProfileId : null);
  const { data: timeline = [], isLoading: feedLoading } = useHomeTimeline(
    socialDataProfileId
  );
  const canBrowseSocial = onNetwork;
  const { like, unlike, edit, remove } = useFeedMutations(myProfileId);

  React.useEffect(() => {
    if (!onNetwork) return;
    void fetch("/api/network/team-follows", { method: "POST" });
  }, [onNetwork, myProfileId]);

  React.useEffect(() => {
    const p = searchParams.get("post");
    if (p) setPostId(p);
  }, [searchParams]);

  React.useEffect(() => {
    if (!discoverQ.trim() || !onNetwork) {
      setDiscoverResults([]);
      return;
    }
    const t = setTimeout(() => {
      void searchArtistProfiles(discoverQ).then(setDiscoverResults).catch(() => {
        setDiscoverResults([]);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [discoverQ, onNetwork]);

  /**
   * Who gets a pin. You come first (so your own city always shows when set),
   * then people you follow, then contacts that link to a profile with a
   * location. Anyone whose location text we can't place is skipped rather
   * than guessed at, and the globe caps the list again on its own.
   */
  const globePeople = React.useMemo<GlobePerson[]>(() => {
    const seen = new Set<string>();
    const out: GlobePerson[] = [];

    if (
      profile &&
      resolveLocation(profile.location, profile.country_code)
    ) {
      seen.add(profile.id);
      out.push({
        id: `me-${profile.id}`,
        name: profile.display_name,
        handle: profile.handle,
        emblemUrl: profile.emblem_url,
        paletteId: profile.palette_id,
        iceColor: profile.ice_color,
        amberColor: profile.amber_color,
        location: profile.location,
        countryCode: profile.country_code,
        detail: "That's you",
        personId: null,
      });
    }

    for (const f of following) {
      const p = f.profile;
      if (!p || seen.has(p.id)) continue;
      if (!resolveLocation(p.location, p.country_code)) continue;
      seen.add(p.id);
      out.push({
        id: `profile-${p.id}`,
        name: p.display_name,
        handle: p.handle,
        emblemUrl: p.emblem_url,
        paletteId: p.palette_id,
        iceColor: p.ice_color,
        amberColor: p.amber_color,
        location: p.location,
        countryCode: p.country_code,
        detail: p.handle ? `@${p.handle}` : "You follow them",
        personId: null,
      });
    }

    for (const person of allPeople) {
      const lp = person.linked_profile;
      if (!lp || seen.has(lp.id)) continue;
      if (!resolveLocation(lp.location, lp.country_code)) continue;
      seen.add(lp.id);
      out.push({
        id: `person-${person.id}`,
        name: lp.display_name ?? person.display_name,
        handle: lp.handle,
        emblemUrl: lp.emblem_url ?? person.avatar_url,
        paletteId: lp.palette_id,
        iceColor: lp.ice_color,
        amberColor: lp.amber_color,
        location: lp.location,
        countryCode: lp.country_code,
        detail:
          person.roles[0] ??
          (person.source === "collaborator"
            ? "Collaborator"
            : person.source.replace("_", " ")),
        personId: person.id,
      });
    }

    return out;
  }, [profile, following, allPeople]);

  const discoverGlobePeople = React.useMemo<GlobePerson[]>(
    () =>
      activeProfiles.map((p) => ({
        id: `discover-${p.id}`,
        name: p.display_name,
        handle: p.handle,
        emblemUrl: p.emblem_url,
        paletteId: p.palette_id,
        iceColor: p.ice_color,
        amberColor: p.amber_color,
        location: p.location,
        countryCode: p.country_code,
        detail: activityLabel(p.last_active_at),
        personId: null,
      })),
    [activeProfiles]
  );
  const displayedGlobePeople =
    tab === "discover" ? discoverGlobePeople : globePeople;

  /** Anyone with an artist_profiles id — the only kind of person a Top 8 pick
   *  can be, since a pick links straight to a profile. */
  const top8Candidates = React.useMemo<Top8Candidate[]>(() => {
    const seen = new Set<string>();
    const out: Top8Candidate[] = [];
    for (const f of following) {
      const p = f.profile;
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        id: p.id,
        name: p.display_name,
        handle: p.handle,
        emblemUrl: p.emblem_url,
        paletteId: p.palette_id,
        iceColor: p.ice_color,
        amberColor: p.amber_color,
      });
    }
    for (const person of allPeople) {
      const lp = person.linked_profile;
      if (!lp || seen.has(lp.id)) continue;
      seen.add(lp.id);
      out.push({
        id: lp.id,
        name: lp.display_name ?? person.display_name,
        handle: lp.handle,
        emblemUrl: lp.emblem_url ?? person.avatar_url,
        paletteId: lp.palette_id,
        iceColor: lp.ice_color,
        amberColor: lp.amber_color,
      });
    }
    return out;
  }, [following, allPeople]);

  const top8 = profile?.top8 ?? [];
  function saveTop8(next: string[]) {
    if (!profile) return;
    save.mutate({ patch: { top8: next }, displayName: profile.display_name });
  }

  /**
   * Discover's default state before you type a search — published artists
   * you've recently worked with, so it's a place to reconnect, not just a
   * search box. `allPeople` already comes back ordered by last_interaction_at
   * (see fetchPeople), so this is just "the recent ones with a live profile,
   * minus anyone you already follow."
   */
  const followingIds = React.useMemo(
    () => new Set(following.map((f) => f.followee_profile_id)),
    [following]
  );

  const recentlyInteracted = React.useMemo<Top8Candidate[]>(() => {
    const seen = new Set<string>();
    const out: Top8Candidate[] = [];
    for (const person of allPeople) {
      const lp = person.linked_profile;
      if (!lp?.handle || seen.has(lp.id) || followingIds.has(lp.id)) continue;
      seen.add(lp.id);
      out.push({
        id: lp.id,
        name: lp.display_name ?? person.display_name,
        handle: lp.handle,
        emblemUrl: lp.emblem_url ?? person.avatar_url,
        paletteId: lp.palette_id,
        iceColor: lp.ice_color,
        amberColor: lp.amber_color,
      });
      if (out.length >= 6) break;
    }
    return out;
  }, [allPeople, followingIds]);

  const tabs: { id: Tab; label: string; needsNetwork?: boolean }[] = [
    { id: "top8", label: "Top 8", needsNetwork: true },
    { id: "following", label: "Follows", needsNetwork: true },
    { id: "discover", label: "Discover", needsNetwork: true },
  ];

  async function joinNetwork() {
    try {
      await publish.mutateAsync("members");
      toast("You’re on the network — visible to TEMPO members.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t join the network.");
    }
  }

  // The shared demo has a curated, explicitly non-interactive network preview.
  // Never leak arbitrary test or member profiles into PRESIDENT's sample feed.
  if (activeArtist?.demo_kind) return <DemoSocialView />;

  const networkGate = (
    <EmptyShaderPanel
      title="You’re off the network"
      copy="Socializing is optional. Stay private and keep using your collaborator contact book — or join when you want follows, a feed, and discovery."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={publish.isPending || profileLoading}
            onClick={() => void joinNetwork()}
          >
            <Users className="size-3.5" />
            Join as TEMPO member
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={mode === "work" ? "/settings?tab=studio" : "/artist"}>
              <Lock className="size-3.5" />
              Network settings
            </Link>
          </Button>
        </div>
      }
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Social"
        subtitle={
          onNetwork
            ? "Your network, follows, and what people you follow are up to."
            : "Your private contact book — join the network anytime if you want to socialize."
        }
        actions={
          onNetwork ? (
            <Button asChild size="sm" variant="secondary">
              <Link href="/messages">
                <MessageSquare className="size-3.5" />
                Messages
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!onNetwork && !profileLoading ? (
        <div className="panel-quiet flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-text-lo">
          <span className="flex items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-text-lo" />
            Off the network — nobody can find or follow you.
          </span>
          <Link href={mode === "work" ? "/settings?tab=studio" : "/artist"} className="text-xs text-ice hover:underline">
            {mode === "work" ? "Change in Settings" : "Change on Artist"}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* ---------- Left: your people ---------- */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-chip border px-3 py-1.5 text-xs transition-colors",
                  tab === t.id
                    ? "border-ice/40 bg-ice/10 text-ice"
                    : "border-line text-text-lo hover:text-text-hi"
                )}
              >
                {t.label}
                {t.needsNetwork && !onNetwork ? (
                  <Lock className="ml-1 inline size-2.5 opacity-60" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Persistent regardless of which tab is active — not tab content. */}
          {canBrowseSocial ? (
            <>
              {displayedGlobePeople.length === 0 ? (
                <p className="text-xs text-text-lo">
                  Nobody has set a location yet — add yours on{" "}
                  {mode === "work" ? "Profile" : "the Artist page"} and you’ll
                  show up here too.
                </p>
              ) : null}
              <ConnectionGlobe
                people={displayedGlobePeople}
                max={tab === "discover" ? 120 : 80}
                onOpenPerson={(id) => {
                  const p = allPeople.find((x) => x.id === id) ?? null;
                  setContact(p);
                }}
                accentIce={accentIce}
                accentAmber={accentAmber}
              />
            </>
          ) : null}

          {tab === "top8" ? (
            canBrowseSocial ? (
              <Top8Rail
                top8={top8}
                candidates={top8Candidates}
                editable={onNetwork}
                saving={save.isPending}
                onChange={saveTop8}
              />
            ) : (
              networkGate
            )
          ) : null}

          {tab === "following" ? (
            canBrowseSocial ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <section>
                  <p className="label-mono mb-2 flex items-center gap-1.5">
                    <Users className="size-3" /> Following (
                    <span className="tabular-nums">{following.length}</span>)
                  </p>
                  <ul className="space-y-1.5">
                    {following.length === 0 ? (
                      <li className="text-sm text-text-lo">Not following anyone yet</li>
                    ) : (
                      following.map((f) => (
                        <li key={f.followee_profile_id}>
                          {f.profile?.handle ? (
                            <Link
                              href={`/artist/${f.profile.handle}`}
                              className="well lift flex items-center gap-3 rounded-input px-3 py-2"
                            >
                              <ArtistMark
                                emblemUrl={f.profile.emblem_url}
                                paletteId={f.profile.palette_id}
                                iceColor={f.profile.ice_color}
                                amberColor={f.profile.amber_color}
                                name={f.profile.display_name}
                                size={18}
                                className="size-[18px]"
                              />
                              <span className="truncate text-sm text-text-hi">
                                {f.profile.display_name}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-sm text-text-lo">Unknown profile</span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </section>
                {onNetwork ? <section>
                  <p className="label-mono mb-2">
                    Followers (<span className="tabular-nums">{followers.length}</span>)
                  </p>
                  <ul className="space-y-1.5">
                    {followers.length === 0 ? (
                      <li className="text-sm text-text-lo">No followers yet</li>
                    ) : (
                      followers.map((f) => (
                        <li key={f.follower_profile_id}>
                          {f.profile?.handle ? (
                            <Link
                              href={`/artist/${f.profile.handle}`}
                              className="well lift flex items-center gap-3 rounded-input px-3 py-2"
                            >
                              <ArtistMark
                                emblemUrl={f.profile.emblem_url}
                                paletteId={f.profile.palette_id}
                                iceColor={f.profile.ice_color}
                                amberColor={f.profile.amber_color}
                                name={f.profile.display_name}
                                size={18}
                                className="size-[18px]"
                              />
                              <span className="truncate text-sm text-text-hi">
                                {f.profile.display_name}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-sm text-text-lo">Unknown profile</span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </section> : null}
              </div>
            ) : (
              networkGate
            )
          ) : null}

          {tab === "discover" ? (
            <div className="max-w-2xl space-y-3">
              <InviteArtistFriend
                artistId={
                  mode === "artist" && activeArtist?.workspace_kind !== "personal"
                    ? activeArtist?.id
                    : null
                }
              />
              {onNetwork ? (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
                  <Input
                    value={discoverQ}
                    onChange={(e) => setDiscoverQ(e.target.value)}
                    placeholder="Search published artists by name"
                    className="pl-9"
                  />
                </div>
                {discoverQ.trim() ? (
                  <>
                    {discoverResults.length === 0 ? (
                      <p className="text-sm text-text-lo">
                        No published artists match that name.
                      </p>
                    ) : null}
                    <ul className="space-y-1.5">
                      {discoverResults.map((p) => (
                        <li key={p.id}>
                          {p.handle ? (
                            <Link
                              href={`/artist/${p.handle}`}
                              className="well lift flex items-center gap-3 rounded-input px-3 py-2.5"
                            >
                              <ArtistMark
                                emblemUrl={p.emblem_url}
                                paletteId={p.palette_id}
                                iceColor={p.ice_color}
                                amberColor={p.amber_color}
                                name={p.display_name}
                                size={20}
                                className="size-5"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm text-text-hi">
                                  {p.display_name}
                                </p>
                                <p className="truncate text-xs text-text-lo">
                                  @{p.handle}
                                  {p.tagline ? ` · ${p.tagline}` : ""}
                                </p>
                              </div>
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="label-mono">Active around TEMPO</p>
                      <span className="text-xs text-text-lo">
                        Followed and new-to-you artists
                      </span>
                    </div>
                    {activeProfiles.length === 0 ? (
                      <p className="text-sm text-text-lo">
                        No recent public activity yet. Try searching for an artist above.
                      </p>
                    ) : (
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                    {uniquePeople.slice(0, 12).map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/artist/${p.handle}`}
                              className="well lift flex h-full items-center gap-3 rounded-input px-3 py-2.5"
                            >
                              <ArtistMark
                                emblemUrl={p.emblem_url}
                                paletteId={p.palette_id}
                                iceColor={p.ice_color}
                                amberColor={p.amber_color}
                                name={p.display_name}
                                size={20}
                                className="size-5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm text-text-hi">
                                    {p.display_name}
                                  </p>
                                  {followingIds.has(p.id) ? (
                                    <span className="shrink-0 rounded-chip border border-ice/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ice">
                                      Following
                                    </span>
                                  ) : null}
                                </div>
                                <p className="truncate text-xs text-text-lo">
                                  @{p.handle} · {activityLabel(p.last_active_at)}
                                </p>
                                <PersonBadges
                                  badges={
                                    p.owner_user_id
                                      ? badgesQuery.data?.get(p.owner_user_id)
                                      : undefined
                                  }
                                />
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flare-line" aria-hidden />
                    <p className="label-mono">Recently interacted with</p>
                    {recentlyInteracted.length === 0 ? (
                      <p className="text-sm text-text-lo">
                        Nothing recent to show — search for an artist above.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {recentlyInteracted.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/artist/${p.handle}`}
                              className="well lift flex items-center gap-3 rounded-input px-3 py-2.5"
                            >
                              <ArtistMark
                                emblemUrl={p.emblemUrl}
                                paletteId={p.paletteId}
                                iceColor={p.iceColor}
                                amberColor={p.amberColor}
                                name={p.name}
                                size={20}
                                className="size-5"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm text-text-hi">
                                  {p.name}
                                </p>
                                <p className="truncate text-xs text-text-lo">
                                  @{p.handle}
                                </p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </>
              ) : (
                networkGate
              )}
            </div>
          ) : null}

        </div>

        {/* ---------- Right: the feed rail ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="panel flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <p className="label-mono">Feed</p>
              {onNetwork && timeline.length ? (
                <span className="text-xs text-text-lo">
                  {timeline.length} recent
                </span>
              ) : null}
            </div>
            <div className="flare-line mx-4 mt-3" aria-hidden />

            {canBrowseSocial ? (
              <div className="relative min-h-0 flex-1">
                <div className="max-h-[34rem] space-y-3 overflow-y-auto px-4 pb-16 pt-3 lg:max-h-none lg:h-full">
                  {onNetwork ? <FeedComposer myProfileId={myProfileId} /> : null}
                  {feedLoading ? (
                    <div className="well h-24 animate-pulse rounded-card" />
                  ) : timeline.length === 0 ? (
                    <p className="py-4 text-sm text-text-lo">
                      Nothing here yet — follow someone, or post an update.
                    </p>
                  ) : (
                    timeline.map((post) => (
                      <FeedPostCard
                        key={post.id}
                        post={post}
                        onLike={() => like.mutate(post.id)}
                        onUnlike={() => unlike.mutate(post.id)}
                        onOpen={() => setPostId(post.id)}
                        myProfileId={myProfileId}
                        savingEdit={edit.isPending && edit.variables?.postId === post.id}
                        onEdit={async (body) => {
                          await edit.mutateAsync({ postId: post.id, body });
                          toast("Post updated.", "ok");
                        }}
                        deleting={remove.isPending && remove.variables === post.id}
                        onDelete={async () => {
                          await remove.mutateAsync(post.id);
                          toast("Post deleted.", "ok");
                        }}
                      />
                    ))
                  )}
                </div>
                {/* Fade the rail out into the dark rather than ending on a hard edge. */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-1 via-bg-1/80 to-transparent"
                  aria-hidden
                />
              </div>
            ) : (
              <div className="space-y-3 p-4 text-sm text-text-lo">
                <p>
                  The feed opens up once you join the network — follows, posts, and
                  what your collaborators are shipping. Use the Join button in the
                  center of the page when you’re ready.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ContactSheet
        person={contact}
        open={!!contact}
        onOpenChange={(o) => {
          if (!o) setContact(null);
        }}
      />
      <PostDetailDialog
        postId={postId}
        myProfileId={myProfileId}
        open={!!postId}
        onOpenChange={(o) => {
          if (!o) setPostId(null);
        }}
      />
    </div>
  );
}
