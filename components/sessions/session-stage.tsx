"use client";

import * as React from "react";
import { Room, Track } from "livekit-client";
import { parseParticipantIdentity } from "@/lib/sessions/room-name";
import type { SessionPresenceParticipant } from "@/lib/sessions/presence";
import type { SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

function VideoTile({
  room,
  identity,
  label,
  local,
}: {
  room: Room;
  identity: string;
  label: string;
  local?: boolean;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const participant = local
      ? room.localParticipant
      : room.remoteParticipants.get(identity);
    if (!participant) return;
    const pub =
      participant.getTrackPublication(Track.Source.ScreenShare) ??
      participant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (!track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  });

  return (
    <div className="relative min-h-0 overflow-hidden rounded-card border border-line bg-bg-0">
      <video ref={ref} className="h-full w-full object-cover" autoPlay playsInline muted={local} />
      <p className="absolute bottom-2 left-2 rounded-chip bg-bg-0/70 px-2 py-0.5 text-[11px] text-text-hi">
        {label}
      </p>
    </div>
  );
}

export function SessionStage({
  room,
  onCall,
  members,
  guestNames,
}: {
  room: Room;
  onCall: SessionPresenceParticipant[];
  members: SessionRoomMember[];
  guestNames?: Map<string, string>;
}) {
  const nameOf = (identity: string) => {
    const parsed = parseParticipantIdentity(identity);
    if (!parsed) return "Someone";
    if (parsed.kind === "guest") return guestNames?.get(parsed.id) || "Guest";
    return members.find((member) => member.user_id === parsed.id)?.display_name || "Member";
  };

  if (onCall.length === 0) {
    return (
      <div className="flex h-full min-h-[10rem] items-center justify-center rounded-card border border-dashed border-line bg-bg-2/30 text-sm text-text-lo">
        Nobody is on the call. Join when you are ready.
      </div>
    );
  }

  return (
    <div className={cn("grid h-full min-h-[12rem] gap-2", onCall.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {onCall.map((person) => (
        <VideoTile
          key={person.identity}
          room={room}
          identity={person.identity}
          label={nameOf(person.identity)}
          local={person.isLocal}
        />
      ))}
    </div>
  );
}
