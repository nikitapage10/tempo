"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, LayoutDashboard, Settings2, Shield, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { FlareLine } from "@/components/flare-line";
import type { Scene } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Real route segments, not tabs — a manager can bookmark the requests queue.
 * Modeled on AdminShell, with one deliberate departure: the mobile nav is a
 * horizontal scroller rather than a `grid-cols-N` pinned to the item count,
 * so adding a section later (topics, events, moderation, settings) never
 * means editing an unrelated grid column count.
 */
export function SceneManageShell({
  scene,
  requestCount = 0,
  reportCount = 0,
  children,
}: {
  scene: Scene;
  requestCount?: number;
  reportCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/scenes/${scene.slug}/manage`;

  const items = [
    { href: base, label: "Overview", icon: LayoutDashboard, count: 0 },
    { href: `${base}/members`, label: "Members", icon: Users, count: requestCount },
    { href: `${base}/events`, label: "Events", icon: CalendarDays, count: 0 },
    { href: `${base}/moderation`, label: "Reports", icon: Shield, count: reportCount },
    ...(scene.my_role === "owner"
      ? [{ href: `${base}/settings`, label: "Settings", icon: Settings2, count: 0 }]
      : []),
  ];

  function isActive(href: string) {
    return href === base ? pathname === base : pathname.startsWith(href);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link
          href={`/scenes/${scene.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-text-lo hover:text-text-hi"
        >
          <ArrowLeft className="size-3" />
          Back to {scene.name}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <ArtistMark
            emblemUrl={scene.emblem_url}
            paletteId={scene.palette_id}
            iceColor={scene.ice_color}
            amberColor={scene.amber_color}
            name={scene.name}
            size={32}
            className="size-8"
          />
          <div>
            <p className="label-mono">Managing</p>
            <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
              {scene.name}
            </h1>
          </div>
        </div>
        <FlareLine className="mt-4 opacity-50" />
      </div>

      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {items.map(({ href, label, icon: Icon, count }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-chip border px-3 py-1.5 text-xs transition-colors",
              isActive(href)
                ? "border-ice/40 bg-ice/10 text-ice"
                : "border-line text-text-lo hover:text-text-hi"
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {count > 0 ? (
              <span className="min-w-4 rounded-full bg-amber/15 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold leading-4 text-amber">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
