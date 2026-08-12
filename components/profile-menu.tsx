"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Disc3,
  Download,
  LogOut,
  Settings,
} from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Toolbar account menu — sits beside Messages for Artist, Settings, Download,
 * and Sign out without hunting through the rail.
 */
export function ProfileMenu() {
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const user = useCurrentUser();
  const { activeArtist } = useActiveArtist();
  const { profile } = useArtistProfile(activeArtist?.id ?? null);

  const displayName =
    profile?.display_name?.trim() ||
    activeArtist?.name?.trim() ||
    "Artist";
  const handle = profile?.handle?.trim() || null;
  const email = user?.email ?? null;

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
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-lo transition-colors duration-hover hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice";

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
          "relative flex size-9 items-center justify-center rounded-full text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          open && "bg-bg-2 text-text-hi"
        )}
      >
        <ArtistMark
          emblemUrl={
            profile?.emblem_url ?? activeArtist?.emblem_url ?? null
          }
          paletteId={activeArtist?.palette_id}
          iceColor={activeArtist?.ice_color}
          amberColor={activeArtist?.amber_color}
          name={displayName}
          size={28}
          className="size-7"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="fixed inset-x-3 top-16 z-[70] overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-64 sm:max-w-[calc(100vw-1.5rem)]"
        >
          <div className="border-b border-line px-3 py-3">
            <p className="truncate font-display text-sm tracking-wide text-text-hi">
              {displayName}
            </p>
            {handle ? (
              <p className="mt-0.5 truncate font-mono text-[11px] text-text-lo">
                @{handle}
              </p>
            ) : null}
            {email ? (
              <p className="mt-0.5 truncate text-xs text-text-lo">{email}</p>
            ) : null}
          </div>

          <div className="py-1">
            <Link
              href="/artist"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Disc3 className="size-4 shrink-0" strokeWidth={1.75} />
              Artist profile
            </Link>
            <Link
              href="/stats"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <BarChart3 className="size-4 shrink-0" strokeWidth={1.75} />
              Stats
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Settings className="size-4 shrink-0" strokeWidth={1.75} />
              Settings
            </Link>
            <Link
              href="/download"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Download className="size-4 shrink-0" strokeWidth={1.75} />
              Download TEMPO
            </Link>
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
