"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CircleUser,
  Disc3,
  Download,
  ExternalLink,
  LogOut,
  MonitorSmartphone,
  Settings,
  Shield,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { SignedImage } from "@/components/ui/signed-image";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { usePlatformAdmin } from "@/hooks/use-admin";
import { useActiveDesktopDevice } from "@/hooks/use-devices";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { fetchMyMemberProfile } from "@/lib/api/member-profile";
import { ROLE_LABELS } from "@/lib/team/roles";
import {
  DESKTOP_WINDOWS_INSTALLER_URL,
  resolveDesktopHandoff,
  type DesktopHandoffKind,
} from "@/lib/desktop/handoff";
import { onOpenWebAppClick } from "@/lib/desktop/bridge";
import { detectOS, isDesktopApp } from "@/lib/platform";
import { getSiteUrl } from "@/lib/site";
import { signOutOfTempo } from "@/lib/auth/reset-client-session";
import { cn, initials } from "@/lib/utils";

function profileHandoffLabel(kind: DesktopHandoffKind): string {
  if (kind === "open-web") return "Open web app";
  if (kind === "open-desktop" || kind === "update-desktop") return "Open TEMPO";
  return "Download TEMPO";
}

/**
 * Toolbar account menu — sits beside Messages for Artist, Settings, desktop
 * handoff (web ↔ app), and Sign out without hunting through the rail. The
 * trigger is your artist profile photo (emblem), same source as the Artist page.
 */
export function ProfileMenu() {
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const user = useCurrentUser();
  const { activeArtist } = useActiveArtist();
  const { mode, role } = useWorkspaceMode();
  const { profile } = useArtistProfile(mode === "artist" ? (activeArtist?.id ?? null) : null);
  const memberProfileQuery = useQuery({
    queryKey: ["my-member-profile"],
    queryFn: fetchMyMemberProfile,
    enabled: mode !== "artist",
    staleTime: 30_000,
  });
  const activeDevice = useActiveDesktopDevice();
  const platformAdmin = usePlatformAdmin();
  React.useMemo(() => detectOS(), []);
  React.useEffect(() => setMounted(true), []);

  const asSelf = mode !== "artist";
  const displayName = asSelf
    ? memberProfileQuery.data?.displayName?.trim() ||
      user?.email?.split("@")[0] ||
      "You"
    : profile?.display_name?.trim() ||
      activeArtist?.name?.trim() ||
      "Artist";
  const handle = asSelf ? null : profile?.handle?.trim() || null;
  const email = user?.email ?? null;
  // A team member sets their photo in Settings > Look, which writes the
  // emblem on their personal workspace row. That is a different field from
  // the Social member profile's avatar, so reading only the latter left the
  // toolbar showing initials next to a photo they had plainly already set.
  // The member profile still wins when it has one; the workspace is the
  // fallback rather than nothing.
  const emblemUrl = asSelf
    ? memberProfileQuery.data?.avatarUrl?.trim() ||
      activeArtist?.emblem_url?.trim() ||
      null
    : activeArtist?.emblem_url?.trim() || profile?.emblem_url?.trim() || null;
  const subtitle = asSelf
    ? role && activeArtist
      ? `${ROLE_LABELS[role]} for ${activeArtist.name}`
      : "Your account"
    : null;

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

  async function handleSignOut() {
    setSigningOut(true);
    setOpen(false);
    await signOutOfTempo();
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice";

  const handoff = mounted
    ? resolveDesktopHandoff({
        isDesktop: isDesktopApp(),
        pathname,
        activeDevice,
        webAppUrl: getSiteUrl(),
        windowsInstallerUrl: DESKTOP_WINDOWS_INSTALLER_URL,
      })
    : null;
  const handoffLabel = handoff ? profileHandoffLabel(handoff.kind) : "Download TEMPO";
  const HandoffIcon =
    handoff?.kind === "open-web"
      ? ExternalLink
      : handoff?.kind === "open-desktop" || handoff?.kind === "update-desktop"
        ? MonitorSmartphone
        : Download;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        title={displayName}
        className={cn(
          "relative size-11 shrink-0 overflow-hidden rounded-full border border-line bg-bg-2 p-0 transition-opacity duration-hover hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:size-12",
          open && "ring-2 ring-ice"
        )}
      >
        {asSelf ? (
          <SignedImage
            path={emblemUrl}
            alt={displayName}
            className="size-full object-cover"
            fallback={
              <div className="flex size-full items-center justify-center font-display text-[11px] text-text-hi">
                {initials(displayName)}
              </div>
            }
          />
        ) : (
          <ArtistMark
            emblemUrl={emblemUrl}
            paletteId={activeArtist?.palette_id}
            iceColor={activeArtist?.ice_color}
            amberColor={activeArtist?.amber_color}
            name={displayName}
            size={36}
            className="size-full rounded-full border-0"
          />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="fixed inset-x-3 top-16 z-[70] overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-64 sm:max-w-[calc(100vw-1.5rem)]"
        >
          <div className="flex items-center gap-3 border-b border-line px-3 py-3">
            {asSelf ? (
              <div className="size-10 shrink-0 overflow-hidden rounded-full border border-line bg-bg-2">
                <SignedImage
                  path={emblemUrl}
                  alt={displayName}
                  className="size-full object-cover"
                  fallback={
                    <div className="flex size-full items-center justify-center font-display text-xs text-text-hi">
                      {initials(displayName)}
                    </div>
                  }
                />
              </div>
            ) : (
              <ArtistMark
                emblemUrl={emblemUrl}
                paletteId={activeArtist?.palette_id}
                iceColor={activeArtist?.ice_color}
                amberColor={activeArtist?.amber_color}
                name={displayName}
                size={40}
                className="size-10 shrink-0 rounded-full"
              />
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-sm tracking-wide text-text-hi">
                {displayName}
              </p>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[11px] text-text-lo">{subtitle}</p>
              ) : null}
              {handle ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-text-lo">
                  @{handle}
                </p>
              ) : null}
              {email ? (
                <p className="mt-0.5 truncate text-xs text-text-lo">{email}</p>
              ) : null}
            </div>
          </div>

          <div className="py-1">
            {asSelf ? (
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <CircleUser className="size-4 shrink-0" strokeWidth={1.75} />
                Your profile
              </Link>
            ) : (
              <Link
                href="/artist"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Disc3 className="size-4 shrink-0" strokeWidth={1.75} />
                Artist profile
              </Link>
            )}
            {mode === "artist" ? (
              <Link
                href="/stats"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <BarChart3 className="size-4 shrink-0" strokeWidth={1.75} />
                Stats
              </Link>
            ) : mode === "entered" ? (
              <Link
                href="/artist"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Disc3 className="size-4 shrink-0" strokeWidth={1.75} />
                Artist profile
              </Link>
            ) : null}
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Settings className="size-4 shrink-0" strokeWidth={1.75} />
              Settings
            </Link>
            {platformAdmin.data ? (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Shield className="size-4 shrink-0" strokeWidth={1.75} />
                Admin portal
              </Link>
            ) : null}
            {handoff ? (
              <a
                href={handoff.href}
                role="menuitem"
                target={handoff.kind === "open-web" ? "_blank" : undefined}
                rel={handoff.kind === "open-web" ? "noreferrer" : undefined}
                onClick={(event) => {
                  setOpen(false);
                  if (handoff.kind === "open-web") {
                    onOpenWebAppClick(event, handoff.href);
                  }
                }}
                className={itemClass}
              >
                <HandoffIcon className="size-4 shrink-0" strokeWidth={1.75} />
                {handoffLabel}
              </a>
            ) : (
              <Link
                href="/download"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Download className="size-4 shrink-0" strokeWidth={1.75} />
                Download TEMPO
              </Link>
            )}
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className={cn(
                itemClass,
                "text-warn hover:text-warn disabled:opacity-50"
              )}
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
