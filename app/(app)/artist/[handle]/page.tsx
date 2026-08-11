"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { SignedImage } from "@/components/ui/signed-image";
import { ArtistProfileImage } from "@/components/artists/artist-mark";
import { ArtistProfileStoryView } from "@/components/artist/profile-story";
import { FollowButton } from "@/components/social/follow-button";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useProfileReleasedTracks } from "@/hooks/use-profile-released-tracks";
import { useMessageMutations } from "@/hooks/use-messages";
import { canDmProfile } from "@/lib/api/messages";
import { fetchArtistProfileByHandle } from "@/lib/api/artist-profile";
import { ModerationReportDialog } from "@/components/social/moderation-report-dialog";

/**
 * Read-only, in-app view of another TEMPO artist's profile, reached from the
 * network (Social) or a shared handle. RLS on `artist_profiles` already
 * limits this to profiles that are `members`/`public` (or your own) — this
 * page adds no visibility logic of its own.
 */
export default function ArtistProfileByHandlePage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;
  const router = useRouter();
  const { activeArtist } = useActiveArtist();
  const { profile: myProfile } = useArtistProfile(activeArtist?.id ?? null);
  const { startDm } = useMessageMutations(myProfile?.id ?? null);
  const [dmBusy, setDmBusy] = React.useState(false);

  const query = useQuery({
    queryKey: ["artist-profile-by-handle", handle],
    queryFn: () => fetchArtistProfileByHandle(handle),
    enabled: !!handle,
  });
  const { tracks: releasedTracks } = useProfileReleasedTracks(
    query.data?.artist_id ?? null
  );

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="panel h-48 animate-pulse" />
        <div className="panel-quiet h-24 animate-pulse" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <EmptyShaderPanel
        title="Profile not found"
        copy="This artist either doesn't exist, hasn't published a profile, or isn't visible to you."
      />
    );
  }

  const profile = query.data;

  return (
    <div className="space-y-5">
      <LfWindow className="glass relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="scrim-reveal absolute inset-0" aria-hidden />
          {profile.banner_url || profile.banner_color ? (
            <div className="absolute inset-0">
              {profile.banner_url ? (
                <SignedImage
                  path={profile.banner_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: profile.banner_color_end
                      ? `linear-gradient(125deg, ${profile.banner_color} 0%, ${profile.banner_color_end} 42%, var(--bg-0) 100%)`
                      : `linear-gradient(180deg, ${profile.banner_color} 0%, var(--bg-0) 100%)`,
                  }}
                />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(10 10 12 / 0.55) 0%, rgb(10 10 12 / 0.8) 70%, var(--bg-0) 100%)",
                }}
              />
            </div>
          ) : null}
        </div>

        {profile.emblem_url ? (
          <ArtistProfileImage
            emblemUrl={profile.emblem_url}
            paletteId={profile.palette_id}
            iceColor={profile.ice_color}
            amberColor={profile.amber_color}
            name={profile.display_name}
            className="absolute inset-y-0 left-[15%] z-[1] hidden w-[23%] sm:flex"
          />
        ) : null}

        <div className="relative z-[2] flex items-start justify-between gap-3 px-6 py-8 sm:px-8 sm:py-10">
          <div className="min-w-0">
            <p className="label-mono mb-1.5">Artist profile</p>
            <h1 className="min-w-0 font-display text-3xl font-medium tracking-[0.025em] text-text-hi sm:text-[40px] sm:leading-[1.05]">
              {profile.display_name}
            </h1>
            {profile.handle ? (
              <p className="mt-1 text-sm text-text-lo">
                @{profile.handle}
                {profile.pronouns ? ` · ${profile.pronouns}` : ""}
                {profile.location ? ` · ${profile.location}` : ""}
              </p>
            ) : null}
            {profile.tagline ? (
              <p className="mt-1.5 max-w-lg text-sm text-text-lo">{profile.tagline}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {myProfile &&
            myProfile.id !== profile.id &&
            myProfile.visibility === "private" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => router.push("/artist")}
              >
                Join the network to follow
              </Button>
            ) : (
              <>
                <FollowButton
                  myProfileId={myProfile?.id ?? null}
                  targetProfileId={profile.id}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={dmBusy || myProfile?.id === profile.id}
                  onClick={async () => {
                    if (!myProfile?.id) return;
                    if (myProfile.visibility === "private") {
                      router.push("/artist");
                      return;
                    }
                    setDmBusy(true);
                    try {
                      const ok = await canDmProfile(profile.id);
                      if (!ok) throw new Error("They aren't accepting messages from you.");
                      const id = await startDm.mutateAsync(profile.id);
                      router.push(`/messages?c=${id}`);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Couldn't start a message.");
                    } finally {
                      setDmBusy(false);
                    }
                  }}
                >
                  <MessageSquare className="size-3.5" />
                  Message
                </Button>
              </>
            )}
            {myProfile && myProfile.id !== profile.id ? <ModerationReportDialog reporterProfileId={myProfile.id} targetType="profile" targetId={profile.id} /> : null}
          </div>
        </div>

        <FlareLine className="relative z-[1] mx-6 mb-6 max-w-[420px] opacity-60 sm:mx-8" />
      </LfWindow>

      <ArtistProfileStoryView profile={profile} releasedTracks={releasedTracks} />
    </div>
  );
}
