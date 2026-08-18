"use client";

import * as React from "react";
import { RoomEvent, Track, type RemoteAudioTrack, type Room } from "livekit-client";

type Sink = { key: string; track: RemoteAudioTrack };

function collect(room: Room): Sink[] {
  const sinks: Sink[] = [];
  for (const participant of Array.from(room.remoteParticipants.values())) {
    for (const publication of Array.from(participant.trackPublications.values())) {
      if (publication.kind !== Track.Kind.Audio) continue;
      const track = publication.track as RemoteAudioTrack | undefined;
      if (!track) continue;
      sinks.push({ key: `${participant.identity}:${publication.trackSid}`, track });
    }
  }
  return sinks;
}

function AudioSink({ track }: { track: RemoteAudioTrack }) {
  const ref = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return <audio ref={ref} autoPlay playsInline />;
}

/**
 * Plays everyone else's microphones.
 *
 * livekit-client subscribes to remote audio but never puts it in an element on
 * its own — without this, a call connects, shows video, and stays completely
 * silent. Rendered once per room, outside the video stage, so a layout change
 * can never drop the sound.
 */
export function SessionAudio({ room }: { room: Room }) {
  const [sinks, setSinks] = React.useState<Sink[]>([]);

  React.useEffect(() => {
    const sync = () => setSinks(collect(room));
    sync();
    room.on(RoomEvent.TrackSubscribed, sync);
    room.on(RoomEvent.TrackUnsubscribed, sync);
    room.on(RoomEvent.ParticipantConnected, sync);
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.ConnectionStateChanged, sync);
    return () => {
      room.off(RoomEvent.TrackSubscribed, sync);
      room.off(RoomEvent.TrackUnsubscribed, sync);
      room.off(RoomEvent.ParticipantConnected, sync);
      room.off(RoomEvent.ParticipantDisconnected, sync);
      room.off(RoomEvent.ConnectionStateChanged, sync);
    };
  }, [room]);

  return (
    <div className="sr-only" aria-hidden>
      {sinks.map((sink) => (
        <AudioSink key={sink.key} track={sink.track} />
      ))}
    </div>
  );
}
