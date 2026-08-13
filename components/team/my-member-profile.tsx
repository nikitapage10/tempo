"use client";

import * as React from "react";
import { Camera } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SignedImage } from "@/components/ui/signed-image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listMemberOfArtists } from "@/lib/api/artist-members";
import {
  fetchMyMemberProfile,
  updateMyMemberProfile,
  uploadMyMemberAvatar,
} from "@/lib/api/member-profile";
import { ownedMusicArtists } from "@/lib/workspace-mode";
import { ROLE_LABELS } from "@/lib/team/roles";
import { initials } from "@/lib/utils";

/**
 * The signed-in person's own identity — name and photo they carry across
 * every artist they work with, plus read-only hats (Artist / Manager for X).
 */
export function MyMemberProfile({ variant = "page" }: { variant?: "page" | "compact" }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const user = useCurrentUser();
  const { artists } = useActiveArtist();
  const query = useQuery({
    queryKey: ["my-member-profile"],
    queryFn: fetchMyMemberProfile,
    staleTime: 30_000,
  });
  const membershipsQuery = useQuery({
    queryKey: ["member-of-artists", user?.id],
    queryFn: listMemberOfArtists,
    enabled: !!user,
    staleTime: 60_000,
  });
  const [name, setName] = React.useState("");
  const [editingName, setEditingName] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (query.data?.displayName) setName(query.data.displayName);
  }, [query.data?.displayName]);

  const saveName = useMutation({
    mutationFn: (displayName: string) => updateMyMemberProfile({ displayName }),
    onSuccess: (profile) => {
      qc.setQueryData(["my-member-profile"], profile);
      setEditingName(false);
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Couldn’t save that name."),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => uploadMyMemberAvatar(file),
    onSuccess: (profile) => qc.setQueryData(["my-member-profile"], profile),
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Couldn’t upload that photo."),
  });

  if (query.isLoading) return <div className="h-40 animate-pulse rounded-panel bg-bg-2/40" />;

  const displayName = query.data?.displayName ?? "";
  const musicOwned = ownedMusicArtists(artists, user?.id);
  const hats = membershipsQuery.data ?? [];

  return (
    <div className={variant === "page" ? "panel space-y-6 p-6" : "panel-quiet flex items-center gap-4 p-4"}>
      <div className={variant === "page" ? "flex flex-col items-start gap-4 sm:flex-row sm:items-center" : "contents"}>
        <div className="relative shrink-0">
          <div
            className={
              variant === "page"
                ? "size-28 overflow-hidden rounded-xl border-2 border-line bg-bg-2"
                : "size-16 overflow-hidden rounded-full border-2 border-line bg-bg-2"
            }
          >
            <SignedImage
              path={query.data?.avatarUrl}
              alt={displayName || "Your photo"}
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center font-display text-lg text-text-hi">
                  {initials(displayName || "?")}
                </div>
              }
            />
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-line bg-bg-1 text-text-lo transition-colors duration-hover hover:text-ice"
            aria-label="Change photo"
            disabled={uploadAvatar.isPending}
          >
            <Camera className="size-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar.mutate(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="label-mono mb-1">Your profile</p>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="h-8 flex-1 rounded-input border border-line bg-bg-2 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                placeholder="Your name"
              />
              <Button
                type="button"
                size="sm"
                disabled={saveName.isPending || !name.trim()}
                onClick={() => saveName.mutate(name.trim())}
              >
                Save
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="font-display text-xl text-text-hi hover:text-ice"
            >
              {displayName || "Add your name"}
            </button>
          )}
          <p className="mt-1 text-xs text-text-lo">
            Shown to every artist you work with — and on Social when you join as yourself.
          </p>
        </div>
      </div>

      {variant === "page" ? (
        <div className="flex flex-wrap gap-1.5">
          {musicOwned.map((artist) => (
            <span
              key={artist.id}
              className="rounded-chip border border-ice/25 px-2 py-0.5 text-[11px] text-ice"
            >
              Artist{artist.name ? ` · ${artist.name}` : ""}
            </span>
          ))}
          {hats.map((m) => {
            const artist = artists.find((a) => a.id === m.artistId);
            return (
              <span
                key={m.artistId}
                className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-text-lo"
              >
                {ROLE_LABELS[m.role]}
                {artist?.name ? ` for ${artist.name}` : ""}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
