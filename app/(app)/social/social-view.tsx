"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, MessageSquare, Search, Users } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { usePeople } from "@/hooks/use-people";
import { useFollowers, useFollowing } from "@/hooks/use-follows";
import { useHomeTimeline, useFeedMutations } from "@/hooks/use-feed";
import { searchArtistProfiles } from "@/lib/api/people";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ContactSheet } from "@/components/social/contact-sheet";
import { FeedComposer } from "@/components/social/feed-composer";
import { FeedPostCard } from "@/components/social/feed-post";
import { NetworkOrbit } from "@/components/social/network-orbit";
import { PostDetailDialog } from "@/components/social/post-detail";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "network" | "feed" | "following" | "discover";

export default function SocialView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading: profileLoading, publish } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const myProfileId = profile?.id ?? null;
  const onNetwork =
    profile?.visibility === "members" || profile?.visibility === "public";

  const [tab, setTab] = React.useState<Tab>("network");
  const [sourceFilter, setSourceFilter] = React.useState<string>("");
  const [q, setQ] = React.useState("");
  const [discoverQ, setDiscoverQ] = React.useState("");
  const [discoverResults, setDiscoverResults] = React.useState<
    Awaited<ReturnType<typeof searchArtistProfiles>>
  >([]);
  const [contact, setContact] = React.useState<Person | null>(null);
  const [postId, setPostId] = React.useState<string | null>(
    searchParams.get("post")
  );

  const { data: people = [], isLoading: peopleLoading } = usePeople({
    source: sourceFilter || undefined,
    q: q || undefined,
  });
  const { data: following = [] } = useFollowing(onNetwork ? myProfileId : null);
  const { data: followers = [] } = useFollowers(onNetwork ? myProfileId : null);
  const { data: timeline = [], isLoading: feedLoading } = useHomeTimeline(
    onNetwork ? myProfileId : null
  );
  const { like, unlike } = useFeedMutations(myProfileId);

  React.useEffect(() => {
    const p = searchParams.get("post");
    if (p) {
      setPostId(p);
      setTab("feed");
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!onNetwork && (tab === "feed" || tab === "following" || tab === "discover")) {
      setTab("network");
    }
  }, [onNetwork, tab]);

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

  const tabs: { id: Tab; label: string; needsNetwork?: boolean }[] = [
    { id: "network", label: "Network" },
    { id: "feed", label: "Feed", needsNetwork: true },
    { id: "following", label: "Follows", needsNetwork: true },
    { id: "discover", label: "Discover", needsNetwork: true },
  ];

  async function joinNetwork() {
    try {
      await publish.mutateAsync("members");
      toast("You’re on the network — visible to TEMPO members.", "ok");
      setTab("feed");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t join the network.");
    }
  }

  const networkGate = (
    <EmptyShaderPanel
      title="You’re off the network"
      copy="Socializing is optional. Stay private and keep using your collaborator contact book below — or join when you want follows, a feed, and discovery."
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
            <Link href="/artist">
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
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={publish.isPending || profileLoading}
              onClick={() => void joinNetwork()}
            >
              <Users className="size-3.5" />
              Join the network
            </Button>
          )
        }
      />

      {!onNetwork && !profileLoading ? (
        <div className="panel-quiet flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-text-lo">
          <span className="flex items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-text-lo" />
            Off the network — nobody can find or follow you.
          </span>
          <Link href="/artist" className="text-xs text-ice hover:underline">
            Change on Artist
          </Link>
        </div>
      ) : null}

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

      {tab === "feed" ? (
        onNetwork ? (
          <div className="mx-auto grid max-w-xl gap-4">
            <FeedComposer myProfileId={myProfileId} />
            {feedLoading ? (
              <div className="panel-quiet h-24 animate-pulse" />
            ) : timeline.length === 0 ? (
              <div className="panel-quiet p-6 text-center text-sm text-text-lo">
                Nothing in your feed yet — follow someone, or post an update.
              </div>
            ) : (
              timeline.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  onLike={() => like.mutate(post.id)}
                  onUnlike={() => unlike.mutate(post.id)}
                  onOpen={() => setPostId(post.id)}
                />
              ))
            )}
          </div>
        ) : (
          networkGate
        )
      ) : null}

      {tab === "network" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or email"
              className="max-w-xs"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-input border border-line bg-bg-2 px-2 py-1.5 text-xs text-text-hi"
            >
              <option value="">All sources</option>
              <option value="collaborator">Collaborators</option>
              <option value="guest_review">Guest reviewers</option>
              <option value="release_credit">Release credits</option>
              <option value="manual">Manual</option>
              <option value="import">Import</option>
            </select>
          </div>
          {peopleLoading ? (
            <div className="panel-quiet h-32 animate-pulse" />
          ) : people.length === 0 ? (
            <div className="panel-quiet p-6 text-sm text-text-lo">
              Nobody in your network yet — invite a collaborator or add release
              credits and they&apos;ll show up here.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => {
                const lp = p.linked_profile;
                const inner = (
                  <div className="well lift flex items-center gap-3 rounded-card p-3">
                    <ArtistMark
                      emblemUrl={lp?.emblem_url ?? p.avatar_url}
                      paletteId={lp?.palette_id}
                      iceColor={lp?.ice_color}
                      amberColor={lp?.amber_color}
                      name={p.display_name}
                      size={22}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-hi">
                        {lp?.display_name ?? p.display_name}
                      </p>
                      <p className="truncate text-xs text-text-lo">
                        {lp?.handle
                          ? `@${lp.handle}`
                          : p.roles[0] || p.source.replace("_", " ")}
                        {p.appearance_count
                          ? ` · ${p.appearance_count} credit${p.appearance_count === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    {lp ? (
                      <span className="rounded-chip border border-ok/30 bg-ok/10 px-2 py-0.5 text-[10px] text-ok">
                        on TEMPO
                      </span>
                    ) : null}
                  </div>
                );
                return lp?.handle ? (
                  <Link key={p.id} href={`/artist/${lp.handle}`}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={p.id}
                    type="button"
                    className="text-left"
                    onClick={() => setContact(p)}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "following" ? (
        onNetwork ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <p className="label-mono mb-2 flex items-center gap-1.5">
                <Users className="size-3" /> Following ({following.length})
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
            <section>
              <p className="label-mono mb-2">Followers ({followers.length})</p>
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
          </div>
        ) : (
          networkGate
        )
      ) : null}

      {tab === "discover" ? (
        onNetwork ? (
          <div className="mx-auto max-w-lg space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
              <Input
                value={discoverQ}
                onChange={(e) => setDiscoverQ(e.target.value)}
                placeholder="Search published artists by name"
                className="pl-9"
              />
            </div>
            {discoverResults.length === 0 && discoverQ.trim() ? (
              <p className="text-sm text-text-lo">No published artists match that name.</p>
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
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-hi">{p.display_name}</p>
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
          </div>
        ) : (
          networkGate
        )
      ) : null}

      <section className="panel overflow-visible pt-4 pb-2">
        <p className="label-mono mb-1 px-4">Your orbit</p>
        <p className="mb-2 px-4 text-xs text-text-lo">
          People from your network — hover a node, click through to a profile.
        </p>
        <NetworkOrbit
          people={people}
          centerName={activeArtist?.name ?? "You"}
          centerEmblemUrl={activeArtist?.emblem_url ?? null}
          centerPaletteId={activeArtist?.palette_id ?? null}
          centerIce={activeArtist?.ice_color}
          centerAmber={activeArtist?.amber_color}
          onOpenPerson={(id) => {
            const p = people.find((x) => x.id === id) ?? null;
            setContact(p);
          }}
        />
      </section>

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
