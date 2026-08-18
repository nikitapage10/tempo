"use client";

import * as React from "react";
import { Mic, MicOff, MonitorUp } from "lucide-react";
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

function participantFor(
  room: Room,
  identity: string,
  local: boolean
): LocalParticipant | RemoteParticipant | undefined {
  return local ? room.localParticipant : room.remoteParticipants.get(identity);
}

/**
 * Loudness per person, sampled on a slow beat. LiveKit updates audioLevel from
 * server speaker reports, so this drives the ring that swells while somebody
 * talks without re-attaching the video underneath.
 */
function useAudioLevels(room: Room, identities: string[], enabled: boolean): Record<string, number> {
  const [levels, setLevels] = React.useState<Record<string, number>>({});
  const key = identities.join("|");

  React.useEffect(() => {
    if (!enabled || !key) {
      setLevels({});
      return;
    }
    const read = () => {
      const next: Record<string, number> = {};
      for (const identity of key.split("|")) {
        const participant =
          room.localParticipant?.identity === identity
            ? room.localParticipant
            : room.remoteParticipants.get(identity);
        const raw = participant?.audioLevel ?? 0;
        next[identity] = Math.round(Math.min(1, raw * 2.2) * 20) / 20;
      }
      setLevels((current) => {
        const sameSize = Object.keys(current).length === Object.keys(next).length;
        if (sameSize && Object.keys(next).every((identity) => current[identity] === next[identity])) {
          return current;
        }
        return next;
      });
    };
    read();
    const timer = window.setInterval(read, 220);
    return () => window.clearInterval(timer);
  }, [enabled, key, room]);

  return levels;
}

function Tile({
  room,
  person,
  level,
  count,
}: {
  room: Room;
  person: Person;
  level: number;
  count: number;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const participant = participantFor(room, person.identity, person.local);
  const screenPub = participant?.getTrackPublication(Track.Source.ScreenShare);
  const cameraPub = participant?.getTrackPublication(Track.Source.Camera);
  const sharing = Boolean(screenPub?.track && !screenPub.isMuted);
  const pub = sharing ? screenPub : cameraPub;
  const showingVideo = Boolean(pub?.track && !pub.isMuted);
  const micPub = participant?.getTrackPublication(Track.Source.Microphone);
  const micOn = Boolean(micPub && !micPub.isMuted);
  const speaking = Boolean(participant?.isSpeaking) || level > 0.12;
  const track = showingVideo ? pub?.track ?? null : null;
  const markSize = count > 4 ? 40 : count > 2 ? 56 : 88;

  // Keyed on the track: presence re-reads on a timer, and re-attaching on
  // every one of those renders makes the picture blink.
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
        "relative isolate min-h-0 overflow-hidden rounded-card border bg-bg-0 transition-colors duration-hover",
        speaking ? "border-amber/50" : "border-line/70"
      )}
      style={
        speaking
          ? {
              boxShadow: `0 0 ${18 + level * 40}px color-mix(in srgb, var(--amber) ${10 + level * 26}%, transparent)`,
            }
          : undefined
      }
    >
      {showingVideo ? (
        <video
          ref={ref}
          className={cn("size-full", sharing ? "object-contain" : "object-cover")}
          autoPlay
          playsInline
          muted={person.local}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(120%_100%_at_50%_0%,rgb(255_255_255/0.05),transparent_72%)]">
          <span className="relative inline-flex items-center justify-center">
            <span
              aria-hidden
              className="absolute rounded-full transition-transform duration-200"
              style={{
                width: markSize,
                height: markSize,
                transform: `scale(${1 + level * 0.55})`,
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--amber) 30%, transparent) 0%, transparent 68%)",
                opacity: speaking ? 1 : 0,
              }}
            />
            <span
              className="relative inline-flex overflow-hidden rounded-full ring-1 ring-white/10"
              style={{ width: markSize, height: markSize }}
            >
              {person.member ? (
                <ArtistMark
                  emblemUrl={person.member.emblem_url}
                  paletteId={person.member.palette_id}
                  iceColor={person.member.ice_color}
                  amberColor={person.member.amber_color}
                  name={person.member.display_name}
                  size={markSize}
                  className="size-full"
                />
              ) : (
                <span
                  className="flex size-full items-center justify-center bg-bg-2 font-display text-text-hi"
                  style={{ fontSize: Math.round(markSize * 0.34) }}
                >
                  {person.label.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-bg-0/85 to-transparent p-2">
        <span className="flex items-center gap-1.5 text-[11px] text-text-hi">
          {micOn ? <Mic className="size-3 text-ok" /> : <MicOff className="size-3 text-warn" />}
          <span className="max-w-[12rem] truncate font-medium">
            {person.label}
            {person.local ? " (you)" : ""}
          </span>
        </span>
        {sharing ? (
          <span className="flex items-center gap-1 rounded-chip bg-ice/15 px-1.5 py-0.5 text-[10px] text-ice">
            <MonitorUp className="size-3" />
            sharing
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Concentric rings that breathe while a hang is open. */
function Beacon({ live }: { live: boolean }) {
  return (
    <span className="relative flex size-16 items-center justify-center">
      {[0, 1, 2].map((ring) => (
        <span
          key={ring}
          aria-hidden
          className={cn(
            "absolute rounded-full border",
            live ? "border-amber/30" : "border-line",
            live && "motion-safe:animate-ping"
          )}
          style={{
            width: `${44 + ring * 16}%`,
            height: `${44 + ring * 16}%`,
            animationDuration: `${2.4 + ring * 0.6}s`,
            animationDelay: `${ring * 0.35}s`,
          }}
        />
      ))}
      <span
        className={cn(
          "relative size-2.5 rounded-full",
          live ? "bg-amber shadow-[0_0_18px_var(--amber)]" : "bg-text-lo/60"
        )}
      />
    </span>
  );
}

export function SessionStage({
  room,
  onCall,
  members,
  guestNames,
  live,
}: {
  room: Room;
  onCall: SessionPresenceParticipant[];
  members: SessionRoomMember[];
  guestNames?: Map<string, string>;
  /** A hang is open, so an empty stage reads as waiting rather than closed. */
  live?: boolean;
}) {
  const people: Person[] = onCall.map((person) => {
    const parsed = parseParticipantIdentity(person.identity);
    const member =
      parsed?.kind === "member" ? members.find((row) => row.user_id === parsed.id) ?? null : null;
    const label =
      member?.display_name ||
      (parsed?.kind === "guest" ? guestNames?.get(parsed.id) : undefined) ||
      person.name ||
      (parsed?.kind === "guest" ? "Guest" : "Someone");
    return { identity: person.identity, label, local: Boolean(person.isLocal), member };
  });

  const levels = useAudioLevels(
    room,
    people.map((person) => person.identity),
    people.length > 0
  );

  if (people.length === 0) {
    return (
      <div className="relative flex h-full min-h-[14rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-card border border-line/70 bg-bg-0/60 px-6 py-10 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background: live
              ? "radial-gradient(80% 100% at 50% 100%, color-mix(in srgb, var(--amber) 14%, transparent) 0%, transparent 70%)"
              : "radial-gradient(80% 100% at 50% 100%, color-mix(in srgb, var(--ice) 9%, transparent) 0%, transparent 70%)",
          }}
        />
        <Beacon live={Boolean(live)} />
        <div className="relative">
          <p className="font-display text-base font-semibold text-text-hi">
            {live ? "The room is open. Nobody is at the mic yet." : "Quiet in here."}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-text-lo">
            {live
              ? "Everybody here can see the hang is running. Join when you are ready to talk."
              : "Start a hang when you want to talk. The agenda, notes, and chat stay put either way."}
          </p>
        </div>
      </div>
    );
  }

  const count = people.length;

  return (
    <div
      className={cn(
        "grid h-full min-h-[14rem] gap-2",
        count === 1
          ? "grid-cols-1"
          : count === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : count <= 4
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3"
      )}
    >
      {people.map((person) => (
        <Tile
          key={person.identity}
          room={room}
          person={person}
          level={levels[person.identity] ?? 0}
          count={count}
        />
      ))}
    </div>
  );
}
