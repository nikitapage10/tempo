"use client";

import * as React from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  CircleUser,
  Disc3,
  Plus,
  Settings2,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { listMemberOfArtists } from "@/lib/api/artist-members";
import { fetchMyMemberProfile } from "@/lib/api/member-profile";
import { ROLE_LABELS } from "@/lib/team/roles";
import {
  membershipArtists,
  ownedMusicArtists,
  ownedPersonalWorkspace,
} from "@/lib/workspace-mode";
import { cn, initials } from "@/lib/utils";

export function ArtistSwitcher() {
  const { artists, activeArtist, setActiveArtistId, isLoading } =
    useActiveArtist();
  const user = useCurrentUser();
  const { mode } = useWorkspaceMode();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const memberProfileQuery = useQuery({
    queryKey: ["my-member-profile"],
    queryFn: fetchMyMemberProfile,
    enabled: mode === "work",
    staleTime: 60_000,
  });
  const label =
    mode === "work"
      ? (memberProfileQuery.data?.displayName?.trim() ||
          (activeArtist?.name && activeArtist.name !== "Your work"
            ? activeArtist.name
            : null) ||
          "Home")
      : (activeArtist?.name ?? "No artist");

  const mightHaveMemberships = artists.some((a) => a.user_id !== user?.id);
  const membershipsQuery = useQuery({
    queryKey: ["member-of-artists", user?.id],
    queryFn: listMemberOfArtists,
    enabled: !!user && mightHaveMemberships,
    staleTime: 60_000,
  });
  const roleByArtistId = new Map(
    (membershipsQuery.data ?? []).map((m) => [m.artistId, m.role])
  );

  const youPersonal = ownedPersonalWorkspace(artists, user?.id);
  const youMusic = ownedMusicArtists(artists, user?.id);
  const withArtists = membershipArtists(artists, user?.id);
  const showGroups = youMusic.length + (youPersonal ? 1 : 0) > 0 && withArtists.length > 0;
  const canManageArtists = mode === "artist";

  React.useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (isLoading) {
    return (
      <div className="mx-auto h-9 w-9 animate-pulse rounded-input border border-line bg-bg-2 min-[960px]:mx-0 min-[960px]:w-full" />
    );
  }

  function row(artist: (typeof artists)[number], chip?: string) {
    const selected = artist.id === activeArtist?.id;
    return (
      <li key={artist.id}>
        <button
          type="button"
          role="option"
          aria-selected={selected}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-hover",
            selected ? "bg-bg-2 text-text-hi" : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
          )}
          onClick={() => {
            setActiveArtistId(artist.id);
            setOpen(false);
          }}
        >
          <Check
            className={cn(
              "size-3.5 shrink-0",
              selected ? "text-ice opacity-100" : "opacity-0"
            )}
          />
          <span className="min-w-0 flex-1 truncate">{artist.name}</span>
          {chip ? (
            <span className="shrink-0 rounded-chip border border-line px-1.5 py-0.5 text-[10px] text-text-lo">
              {chip}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={mode === "work" ? `Working as ${label}` : `Artist: ${label}`}
        className="flex w-full items-center justify-center gap-2.5 rounded-input px-1.5 py-1.5 text-left text-sm text-text-hi transition-colors duration-hover hover:bg-bg-2/60 min-[960px]:justify-start min-[960px]:px-2"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-input border border-line bg-bg-2 font-display text-[11px] tracking-wide text-text-hi min-[960px]:hidden">
          {initials(label)}
        </span>
        <span className="hidden min-w-0 truncate font-display text-[13px] tracking-wide min-[960px]:inline">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto hidden size-3 shrink-0 text-text-lo transition-transform duration-hover min-[960px]:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-full top-0 z-50 ml-1.5 w-56 overflow-hidden rounded-card border border-line bg-bg-1 shadow-raise min-[960px]:left-0 min-[960px]:right-0 min-[960px]:top-auto min-[960px]:ml-0 min-[960px]:mt-1.5 min-[960px]:w-auto"
        >
          <ul className="max-h-56 overflow-y-auto py-1">
            {showGroups ? (
              <>
                <li className="px-3 py-1.5 label-mono text-text-lo">You</li>
                {youPersonal ? row(youPersonal, "You") : null}
                {youMusic.map((a) => row(a, "Artist"))}
                <li className="px-3 py-1.5 label-mono text-text-lo">Artists you work with</li>
                {withArtists.map((a) =>
                  row(a, roleByArtistId.get(a.id) ? ROLE_LABELS[roleByArtistId.get(a.id)!] : undefined)
                )}
              </>
            ) : (
              artists.map((artist) => {
                const memberRole = roleByArtistId.get(artist.id);
                const chip =
                  artist.id === youPersonal?.id
                    ? "You"
                    : memberRole
                      ? ROLE_LABELS[memberRole]
                      : undefined;
                return row(artist, chip);
              })
            )}
          </ul>
          <div className="border-t border-line">
            {mode === "work" ? (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
              >
                <CircleUser className="size-3.5" />
                Your profile
              </Link>
            ) : (
              <Link
                href="/artist"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
              >
                <Disc3 className="size-3.5" />
                Artist profile
              </Link>
            )}
            {mode === "artist" ? (
              <Link
                href="/stats"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
              >
                <BarChart3 className="size-3.5" />
                Stats
              </Link>
            ) : null}
            <Link
              href="/team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
            >
              <Users2 className="size-3.5" />
              {mode === "work" ? "Artists you work with" : "Team"}
            </Link>
            {canManageArtists ? (
              <>
                <Link
                  href="/settings?tab=studio#artists"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi"
                >
                  <Settings2 className="size-3.5" />
                  Manage artists
                </Link>
                <Link
                  href="/settings?tab=studio#artists"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ice transition-colors duration-hover hover:bg-bg-2/60"
                >
                  <Plus className="size-3.5" />
                  New artist
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
