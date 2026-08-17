"use client";

import { parseParticipantIdentity } from "@/lib/sessions/room-name";
import type { SessionPresenceParticipant } from "@/lib/sessions/presence";
import type { SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  return (
    <ul className="flex flex-wrap gap-1.5">
      {members.map((member) => {
        const live = inRoomIds.has(member.user_id);
        const calling = onCallIds.has(member.user_id);
        return (
          <li
            key={member.user_id}
            className={cn(
              "rounded-chip border px-2 py-0.5 text-xs",
              calling
                ? "border-amber/40 bg-amber/10 text-amber"
                : live
                  ? "border-ice/40 bg-ice/10 text-ice"
                  : "border-line text-text-lo"
            )}
          >
            {member.display_name}
            {member.role === "host" ? " · host" : ""}
            {calling ? " · on the call" : live ? " · in the room" : ""}
          </li>
        );
      })}
    </ul>
  );
}
