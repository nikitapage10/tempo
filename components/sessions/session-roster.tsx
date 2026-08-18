"use client";

import { parseParticipantIdentity } from "@/lib/sessions/room-name";
import type { SessionPresenceParticipant } from "@/lib/sessions/presence";
import type { SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { key: string; name: string; note: string; state: "call" | "room" | "away" };

function chipClass(state: Row["state"]): string {
  if (state === "call") return "border-amber/40 bg-amber/10 text-amber";
  if (state === "room") return "border-ice/35 bg-ice/10 text-ice";
  return "border-line text-text-lo";
}

export function SessionRoster({
  members,
  inRoom,
  onCall,
}: {
  members: SessionRoomMember[];
  inRoom: SessionPresenceParticipant[];
  onCall: SessionPresenceParticipant[];
}) {
  const onCallIds = new Set(
    onCall.map((person) => parseParticipantIdentity(person.identity)?.id).filter(Boolean)
  );
  const inRoomIds = new Set(
    inRoom.map((person) => parseParticipantIdentity(person.identity)?.id).filter(Boolean)
  );

  const rows: Row[] = members.map((member) => {
    const calling = onCallIds.has(member.user_id);
    const here = inRoomIds.has(member.user_id);
    return {
      key: member.user_id,
      name: member.display_name,
      note: member.role === "host" ? "host" : "",
      state: calling ? "call" : here ? "room" : "away",
    };
  });

  for (const person of inRoom) {
    const parsed = parseParticipantIdentity(person.identity);
    if (parsed?.kind !== "guest") continue;
    rows.push({
      key: person.identity,
      name: person.name || "Guest",
      note: "guest",
      state: onCallIds.has(parsed.id) ? "call" : "room",
    });
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className={cn("inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-xs", chipClass(row.state))}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              row.state === "call" ? "bg-amber" : row.state === "room" ? "bg-ice" : "bg-text-lo/50"
            )}
          />
          {row.name}
          {row.note ? <span className="opacity-70">{row.note}</span> : null}
          <span className="opacity-70">
            {row.state === "call" ? "on the call" : row.state === "room" ? "in the room" : "away"}
          </span>
        </li>
      ))}
    </ul>
  );
}
