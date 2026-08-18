"use client";

import Link from "next/link";
import { CheckSquare, ListChecks, Radio } from "lucide-react";
import { LivePill, SessionAvatarStack } from "@/components/sessions/session-people";
import { SignedImage } from "@/components/ui/signed-image";
import { useTrack } from "@/hooks/use-tracks";
import type { SessionRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

function instanceSummary(room: SessionRoom): string {
  if (room.hang_count <= 0) return "No sessions yet";
  const sessions = room.hang_count === 1 ? "1 session" : `${room.hang_count} sessions`;
  if (!room.last_hang_at) return sessions;
  const last = new Date(room.last_hang_at);
  const label = last.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${sessions}, last ${label}`;
}

export function SessionCard({ room }: { room: SessionRoom }) {
  const focusedTrack = useTrack(room.track_id);
  const live = Boolean(room.open_meet_id);
  const hosts = room.members.filter((member) => member.role === "host");
  const hostLine = hosts.length ? `Hosted by ${hosts.map((host) => host.display_name).join(", ")}` : "";

  return (
    <Link
      href={`/sessions/${room.id}`}
      className={cn(
        "panel group relative flex min-h-[9.5rem] flex-col overflow-hidden p-4 transition-transform duration-hover hover:-translate-y-0.5",
        live && "border-amber/35"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 transition-opacity duration-hover",
          live ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{
          background: live
            ? "radial-gradient(120% 100% at 20% 0%, color-mix(in srgb, var(--amber) 14%, transparent) 0%, transparent 70%)"
            : "radial-gradient(120% 100% at 20% 0%, color-mix(in srgb, var(--ice) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {room.track_id ? (
            <span className="relative size-10 shrink-0 overflow-hidden rounded-input bg-bg-2">
              <SignedImage path={focusedTrack.data?.artwork_url ?? null} className="absolute inset-0 size-full object-cover" />
            </span>
          ) : null}
          <div className="min-w-0">
          <h2 className="truncate font-display text-base font-semibold text-text-hi">{room.title}</h2>
          {hostLine ? <p className="mt-0.5 truncate text-xs text-text-lo">{hostLine}</p> : null}
            {focusedTrack.data ? <p className="mt-0.5 truncate text-xs text-ice">{focusedTrack.data.title}</p> : null}
          </div>
        </div>
        <SessionAvatarStack members={room.members} size={26} />
      </div>

      {room.purpose ? (
        <p className="relative mt-2 line-clamp-2 text-sm leading-5 text-text-lo">{room.purpose}</p>
      ) : null}

      <div className="relative mt-auto pt-3">
        {live ? (
          <div className="mb-2">
            <LivePill label="LIVE" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px] text-text-lo">
          <span className="inline-flex items-center gap-1">
            <Radio className="size-3 text-text-lo" />
            {instanceSummary(room)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3 text-text-lo" />
            {room.open_agenda_count} open
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3 text-text-lo" />
            {room.task_count} {room.task_count === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>
    </Link>
  );
}
