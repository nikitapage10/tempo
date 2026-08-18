"use client";

import * as React from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { Room, Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";
import { ArtistMark } from "@/components/artists/artist-mark";
import { parseParticipantIdentity } from "@/lib/sessions/room-name";
import type { SessionPresenceParticipant } from "@/lib/sessions/presence";
import type { SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type Person = {
  identity: string;
  label: string;
  local: boolean;
  member: SessionRoomMember | null;
};

function participantFor(room: Room, identity: string, local: boolean): LocalParticipant | RemoteParticipant | undefined {
  return local ? room.localParticipant : room.remoteParticipants.get(identity);
}

function VideoTile({ room, person, dense }: { room: Room; person: Person; dense: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const participant = participantFor(room, person.identity, person.local);
  const screenPub = participant?.getTrackPublication(Track.Source.ScreenShare);
  const cameraPub = participant?.getTrackPublication(Track.Source.Camera);
  const pub = screenPub?.track ? screenPub : cameraPub;
  const showingVideo = Boolean(pub?.track && !pub.isMuted);
  const micPub = participant?.getTrackPublication(Track.Source.Microphone);
  const micOn = Boolean(micPub && !micPub.isMuted);
  const speaking = Boolean(participant?.isSpeaking);
  const track = showingVideo ? pub?.track ?? null : null;

  // Keyed on the track itself: presence re-reads on a timer, and re-attaching
  // on every one of those renders makes the picture blink.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-card border bg-bg-0 transition-colors duration-hover",
        speaking ? "border-amber/45" : "border-line"
      )}
    >
      {showingVideo ? (
        <video ref={ref} className="size-full object-cover" autoPlay playsInline muted={person.local} />
      ) : (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(120%_100%_at_50%_0%,rgb(255_255_255/0.04),transparent_70%)]">
          {person.member ? (
            <span
              className="inline-flex overflow-hidden rounded-full"
              style={{ width: dense ? 44 : 64, height: dense ? 44 : 64 }}
            >
              <ArtistMark
                emblemUrl={person.member.emblem_url}
                paletteId={person.member.palette_id}
                iceColor={person.member.ice_color}
                amberColor={person.member.amber_color}
                name={person.member.display_name}
                size={dense ? 44 : 64}
                className="size-full"
              />
            </span>
          ) : (
            <span
              className="flex items-center justify-center rounded-full border border-line bg-bg-2 font-display text-text-hi"
              style={{ width: dense ? 44 : 64, height: dense ? 44 : 64, fontSize: dense ? 15 : 20 }}
            >
              {person.label.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-chip bg-bg-0/75 px-2 py-0.5 text-[11px] text-text-hi backdrop-blur-sm">
        {micOn ? <Mic className="size-3 text-ok" /> : <MicOff className="size-3 text-text-lo" />}
        <span className="max-w-[10rem] truncate">
          {person.label}
          {person.local ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}

export function SessionStage({
  room,
  onCall,
  members,
  guestNames,
  live,
  action,
}: {
  room: Room;
  onCall: SessionPresenceParticipant[];
  members: SessionRoomMember[];
  guestNames?: Map<string, string>;
  /** A hang is open, so the empty stage should read as waiting rather than closed. */
  live?: boolean;
  /** Join control, so the invitation and the button live in the same place. */
  action?: React.ReactNode;
}) {
  const people: Person[] = onCall.map((person) => {
    const parsed = parseParticipantIdentity(person.identity);
    const member = parsed?.kind === "member" ? members.find((row) => row.user_id === parsed.id) ?? null : null;
    const label =
      member?.display_name ||
      (parsed?.kind === "guest" ? guestNames?.get(parsed.id) : undefined) ||
      person.name ||
      (parsed?.kind === "guest" ? "Guest" : "Someone");
    return { identity: person.identity, label, local: Boolean(person.isLocal), member };
  });

  if (people.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line bg-[radial-gradient(120%_90%_at_50%_0%,rgb(255_255_255/0.035),transparent_70%)] px-6 py-8 text-center">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border",
            live ? "border-amber/35 bg-amber/10 text-amber" : "border-line bg-bg-2/60 text-text-lo"
          )}
        >
          <Radio className="size-5" />
        </span>
        <div>
          <p className="text-sm text-text-hi">{live ? "The hang is open." : "Nobody is on the call."}</p>
          <p className="mt-1 text-xs text-text-lo">
            {live
              ? "Everyone in the room can see it is running. Join when you are ready."
              : "Turn your mic on whenever you want to talk. The room stays here either way."}
          </p>
        </div>
        {action}
      </div>
    );
  }

  const dense = people.length > 2;

  return (
    <div
      className={cn(
        "grid h-full min-h-[12rem] gap-2",
        people.length === 1 ? "grid-cols-1" : people.length <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
      )}
    >
      {people.map((person) => (
        <VideoTile key={person.identity} room={room} person={person} dense={dense} />
      ))}
    </div>
  );
}
