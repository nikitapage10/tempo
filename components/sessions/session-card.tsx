"use client";

import Link from "next/link";
import { GroupAvatar } from "@/components/messages/group-avatar";
import { LfWindow } from "@/components/lf-windows";
import type { SessionRoom } from "@/lib/types";
import { cn } from "@/lib/utils";

function hangSummary(room: SessionRoom): string {
  if (room.hang_count <= 0) return "No hangs yet";
  const hangs = room.hang_count === 1 ? "1 hang" : `${room.hang_count} hangs`;
  if (!room.last_hang_at) return hangs;
  const last = new Date(room.last_hang_at);
  const label = last.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return `${hangs}, last ${label}`;
}

export function SessionCard({ room }: { room: SessionRoom }) {
  const live = Boolean(room.open_meet_id);
  const peers = room.members.map((member) => ({
    id: member.profile_id,
    handle: member.user_id,
    display_name: member.display_name,
    emblem_url: member.emblem_url,
    palette_id: member.palette_id ?? "spectra",
    ice_color: member.ice_color,
    amber_color: member.amber_color,
  }));

  return (
    <Link href={`/sessions/${room.id}`} className="panel-quiet block p-4 transition-colors duration-hover hover:bg-bg-2/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-semibold text-text-hi">{room.title}</h2>
            {live ? (
              <span className="relative inline-flex size-4 items-center justify-center" aria-label="Hang open">
                <LfWindow className="absolute inset-0 rounded-full" field />
                <span className="relative size-1.5 rounded-full bg-amber" />
              </span>
            ) : null}
          </div>
          {room.purpose ? <p className="mt-1 line-clamp-2 text-sm text-text-lo">{room.purpose}</p> : null}
          <p className="mt-2 text-xs text-text-lo">{hangSummary(room)}</p>
        </div>
        <GroupAvatar members={peers} size={28} />
      </div>
      <p className={cn("mt-3 font-data text-[11px] text-text-lo")}>
        {room.open_agenda_count} open on the agenda
        {" · "}
        {room.task_count} {room.task_count === 1 ? "task" : "tasks"}
      </p>
    </Link>
  );
}
