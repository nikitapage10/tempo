"use client";

import Link from "next/link";
import { CheckSquare, ListChecks, Radio } from "lucide-react";
import { LivePill, SessionAvatarStack } from "@/components/sessions/session-people";
import type { SessionRoom } from "@/lib/types";

function hangSummary(room: SessionRoom): string {
  if (room.hang_count <= 0) return "No hangs yet";
  const hangs = room.hang_count === 1 ? "1 hang" : `${room.hang_count} hangs`;
  if (!room.last_hang_at) return hangs;
  const last = new Date(room.last_hang_at);
  const label = last.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${hangs} · last ${label}`;
}

export function SessionCard({ room }: { room: SessionRoom }) {
  const live = Boolean(room.open_meet_id);
  const hosts = room.members.filter((member) => member.role === "host");
  const hostLine = hosts.length ? `Hosted by ${hosts.map((host) => host.display_name).join(", ")}` : "";

  return (
    <Link
      href={`/sessions/${room.id}`}
      className="panel group relative flex min-h-[9.5rem] flex-col overflow-hidden p-4 transition-transform duration-hover hover:-translate-y-0.5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-0 transition-opacity duration-hover group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 100% at 20% 0%, color-mix(in srgb, var(--ice) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-semibold text-text-hi">{room.title}</h2>
          {hostLine ? <p className="mt-0.5 truncate text-xs text-text-lo">{hostLine}</p> : null}
        </div>
        <SessionAvatarStack members={room.members} size={26} />
      </div>

      {room.purpose ? (
        <p className="relative mt-2 line-clamp-2 text-sm leading-5 text-text-lo">{room.purpose}</p>
      ) : null}

      <div className="relative mt-auto pt-3">
        {live ? (
          <div className="mb-2">
            <LivePill label="Hang is open" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px] text-text-lo">
          <span className="inline-flex items-center gap-1">
            <Radio className="size-3 text-text-lo" />
            {hangSummary(room)}
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
