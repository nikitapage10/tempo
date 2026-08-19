"use client";

import * as React from "react";
import Link from "next/link";
import { NotebookPen, Radio } from "lucide-react";
import { FlareLine } from "@/components/flare-line";
import { OnAirPlate, SessionAvatarStack } from "@/components/sessions/session-people";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/ui/signed-image";
import type { SessionPresenceParticipant } from "@/lib/sessions/presence";
import { parseParticipantIdentity } from "@/lib/sessions/room-name";
import type { SessionRoom } from "@/lib/types";

function elapsedLabel(startedAt: string | null): string {
  if (!startedAt) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function InstanceClock({ startedAt }: { startedAt: string | null }) {
  const [label, setLabel] = React.useState(() => elapsedLabel(startedAt));
  React.useEffect(() => {
    setLabel(elapsedLabel(startedAt));
    if (!startedAt) return;
    const timer = window.setInterval(() => setLabel(elapsedLabel(startedAt)), 1_000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return label ? <span className="font-data text-xs tabular-nums text-amber">{label}</span> : null;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function SessionHeader({
  room,
  focusedTrack,
  currentVersionNo,
  tracks,
  live,
  notesActive,
  loudestLevel,
  inRoom,
  onCall,
  isHost,
  onShare,
  onToggleNotes,
  onEnd,
  onStart,
  onTrackChange,
}: {
  room: SessionRoom;
  focusedTrack: { title: string; artwork_url: string | null } | null;
  currentVersionNo: number | null;
  tracks: Array<{ id: string; title: string }>;
  live: boolean;
  notesActive: boolean;
  loudestLevel: number;
  inRoom: SessionPresenceParticipant[];
  onCall: SessionPresenceParticipant[];
  isHost: boolean;
  onShare: () => void;
  onToggleNotes: () => void;
  onEnd: () => void;
  onStart: () => void;
  onTrackChange: (trackId: string | null) => void;
}) {
  const reducedMotion = useReducedMotion();
  const washOpacity = live ? (reducedMotion ? 0.14 : 0.1 + Math.min(1, loudestLevel) * 0.08) : 0;
  const inRoomIds = inRoom.map((person) => parseParticipantIdentity(person.identity)?.id).filter((id): id is string => Boolean(id));
  const onCallIds = onCall.map((person) => parseParticipantIdentity(person.identity)?.id).filter((id): id is string => Boolean(id));
  const rosterTitle = room.members.map((member) => {
    const status = onCallIds.includes(member.user_id) ? "on the call" : inRoomIds.includes(member.user_id) ? "in the room" : "away";
    return `${member.display_name}, ${status}`;
  }).join("\n");

  return (
    <header className="panel relative shrink-0 overflow-hidden px-4 py-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none"
        style={{
          opacity: washOpacity,
          background: "radial-gradient(120% 140% at 8% 0%, var(--amber) 0%, transparent 62%)",
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OnAirPlate live={live} />
            <InstanceClock startedAt={live ? room.open_meet_started_at : null} />
            {live ? <span className="font-data text-xs text-text-lo">{ordinal(room.hang_count)} session</span> : null}
            {notesActive ? <span className="rounded-chip border border-amber/30 bg-amber/10 px-2 py-1 text-[11px] text-amber">Taking notes</span> : null}
          </div>
          <h1 className="mt-2 truncate font-display text-2xl font-semibold tracking-[0.02em] text-text-hi sm:text-[28px]">{room.title}</h1>
          {room.purpose ? <p className="mt-1 max-w-2xl text-sm text-text-lo">{room.purpose}</p> : null}
          {room.track_id ? focusedTrack ? (
            <Link href={`/track/${room.track_id}`} className="mt-3 flex w-fit items-center gap-2 rounded-input text-sm text-text-hi hover:text-ice">
              <span className="relative size-10 overflow-hidden rounded-input bg-bg-2">
                <SignedImage path={focusedTrack.artwork_url} className="absolute inset-0 size-full object-cover" />
              </span>
              <span>
                <span className="block font-medium">{focusedTrack.title}</span>
                <span className="block font-data text-xs text-text-lo">{currentVersionNo ? `v${currentVersionNo}` : "Nothing to play yet"}</span>
              </span>
            </Link>
          ) : <p className="mt-3 text-xs text-text-lo">A song you do not have access to</p> : <p className="mt-3 text-xs text-text-lo">No song yet</p>}
          {tracks.length ? (
            <select aria-label="Session song" className="mt-2 h-8 max-w-xs rounded-input border border-line bg-bg-2 px-2 text-xs text-text-lo" value={room.track_id ?? ""} onChange={(event) => onTrackChange(event.target.value || null)}>
              <option value="">No song yet</option>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
            </select>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <Button type="button" size="sm" variant="ghost" aria-pressed={notesActive} onClick={onToggleNotes} className={notesActive ? "text-amber" : undefined}>
              <NotebookPen className="size-4" />
              {notesActive ? "Taking notes" : "Take notes"}
            </Button>
          ) : null}
          {isHost ? <Button type="button" size="sm" variant="secondary" onClick={onShare}>Share link</Button> : null}
          {live ? <Button type="button" size="sm" variant="secondary" onClick={onEnd}>End session</Button> : (
            <Button type="button" size="sm" onClick={onStart}><Radio className="size-4" />Start session</Button>
          )}
        </div>
      </div>
      <div className="relative mt-3 w-fit" title={rosterTitle}>
        <SessionAvatarStack members={room.members} size={26} max={6} inRoom={inRoomIds} onCall={onCallIds} />
        <span className="sr-only">{rosterTitle}</span>
      </div>
      <FlareLine className="mt-3 opacity-50" />
    </header>
  );
}
