"use client";

import * as React from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { decodePacket, encodePacket, type CallPacket } from "@/lib/calls/protocol";
import type { CallScope } from "@/lib/calls/room-name";
import {
  HIDDEN_DISCONNECT_MS,
  shouldDisconnectWhenHidden,
} from "@/lib/sessions/livekit-room";
import { splitRoster, type SessionPresenceParticipant } from "@/lib/sessions/presence";

type CallToken = { token: string; url: string; roomName: string };

async function fetchMemberToken(scope: CallScope, roomId: string): Promise<CallToken> {
  const response = await fetch(`/api/calls/${scope}/${roomId}/livekit-token`, { method: "POST" });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Couldn’t join the room.");
  }
  return {
    token: String(body.token ?? ""),
    url: String(body.url ?? ""),
    roomName: String(body.roomName ?? ""),
  };
}

function connectOptions(): { rtcConfig?: RTCConfiguration } {
  try {
    if (window.sessionStorage.getItem("tempo:session-call-relay") === "1") {
      return { rtcConfig: { iceTransportPolicy: "relay" } };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function snapshot(room: Room): SessionPresenceParticipant[] {
  const locals: SessionPresenceParticipant[] = room.localParticipant
    ? [
        {
          identity: room.localParticipant.identity,
          name: room.localParticipant.name,
          attributes: room.localParticipant.attributes,
          isLocal: true,
        },
      ]
    : [];
  const remotes: SessionPresenceParticipant[] = Array.from(room.remoteParticipants.values()).map(
    (participant) => ({
      identity: participant.identity,
      name: participant.name,
      attributes: participant.attributes,
      isLocal: false,
    })
  );
  return [...locals, ...remotes];
}

/** Presence can drift if a LiveKit event is missed; re-read the room on a slow beat. */
const PRESENCE_POLL_MS = 4_000;

/** Who is here and who is on the call, so the poll only re-renders on real movement. */
function rosterSignature(people: SessionPresenceParticipant[]): string {
  return people
    .map((person) => `${person.identity}:${person.name ?? ""}:${person.attributes?.oncall ?? ""}`)
    .join("|");
}

export function useSessionCall(input: {
  roomId: string | null;
  enabled: boolean;
  scope?: CallScope;
  fetchToken?: () => Promise<CallToken>;
}) {
  const [room] = React.useState(() => new Room());
  const [connection, setConnection] = React.useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = React.useState<SessionPresenceParticipant[]>([]);
  const [onCall, setOnCall] = React.useState(false);
  const [micEnabled, setMicEnabled] = React.useState(false);
  const [cameraEnabled, setCameraEnabled] = React.useState(false);
  const [screenEnabled, setScreenEnabled] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = React.useState(false);
  const [chatTick, setChatTick] = React.useState(0);
  const [callPacket, setCallPacket] = React.useState<{
    packet: Exclude<CallPacket, { kind: "chat" }>;
    fromIdentity: string | null;
    receivedAtMs: number;
  } | null>(null);
  const hiddenSince = React.useRef<number | null>(null);
  const onCallRef = React.useRef(false);
  const { enabled, roomId } = input;

  // The caller usually passes an inline arrow (the guest view closes over its
  // link token). Holding it in a ref means a parent re-render can never tear
  // the LiveKit connection down and build it back up — that churn is what made
  // guests miss the moment somebody joined the call.
  const fetchTokenRef = React.useRef(input.fetchToken);
  React.useEffect(() => {
    fetchTokenRef.current = input.fetchToken;
  }, [input.fetchToken]);

  React.useEffect(() => {
    onCallRef.current = onCall;
  }, [onCall]);

  const refresh = React.useCallback(() => {
    const next = snapshot(room);
    setParticipants((prev) => (rosterSignature(prev) === rosterSignature(next) ? prev : next));
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setScreenEnabled(room.localParticipant.isScreenShareEnabled);
    setOnCall(room.localParticipant.attributes?.oncall === "1");
  }, [room]);

  const credentials = React.useCallback(async (): Promise<CallToken> => {
    const custom = fetchTokenRef.current;
    if (custom) return custom();
    if (!roomId) throw new Error("Couldn’t join the room.");
    return fetchMemberToken(input.scope ?? "session", roomId);
  }, [input.scope, roomId]);

  React.useEffect(() => {
    const bump = () => refresh();
    const onData = (payload: Uint8Array, participant?: { identity?: string }) => {
      const parsed = decodePacket(payload);
      if (!parsed) return;
      if (parsed.kind === "chat") {
        setChatTick((value) => value + 1);
        return;
      }
      setCallPacket({
        packet: parsed,
        fromIdentity: participant?.identity ?? null,
        receivedAtMs: Date.now(),
      });
    };
    room.on(RoomEvent.ParticipantConnected, bump);
    room.on(RoomEvent.ParticipantDisconnected, bump);
    room.on(RoomEvent.ParticipantAttributesChanged, bump);
    room.on(RoomEvent.TrackPublished, bump);
    room.on(RoomEvent.TrackUnpublished, bump);
    room.on(RoomEvent.TrackMuted, bump);
    room.on(RoomEvent.TrackUnmuted, bump);
    room.on(RoomEvent.TrackSubscribed, bump);
    room.on(RoomEvent.TrackUnsubscribed, bump);
    room.on(RoomEvent.LocalTrackPublished, bump);
    room.on(RoomEvent.LocalTrackUnpublished, bump);
    room.on(RoomEvent.DataReceived, onData);
    const onConnection = (state: ConnectionState) => {
      setConnection(state);
      bump();
    };
    const onPlayback = () => setAudioBlocked(!room.canPlaybackAudio);
    room.on(RoomEvent.ConnectionStateChanged, onConnection);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onPlayback);
    return () => {
      // Never removeAllListeners here: the audio renderer listens on the same
      // room, and tearing its handlers off would silence the call.
      room.off(RoomEvent.ParticipantConnected, bump);
      room.off(RoomEvent.ParticipantDisconnected, bump);
      room.off(RoomEvent.ParticipantAttributesChanged, bump);
      room.off(RoomEvent.TrackPublished, bump);
      room.off(RoomEvent.TrackUnpublished, bump);
      room.off(RoomEvent.TrackMuted, bump);
      room.off(RoomEvent.TrackUnmuted, bump);
      room.off(RoomEvent.TrackSubscribed, bump);
      room.off(RoomEvent.TrackUnsubscribed, bump);
      room.off(RoomEvent.LocalTrackPublished, bump);
      room.off(RoomEvent.LocalTrackUnpublished, bump);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ConnectionStateChanged, onConnection);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onPlayback);
    };
  }, [refresh, room]);

  React.useEffect(() => {
    if (!enabled || !roomId) return;
    let cancelled = false;
    const connect = async () => {
      try {
        setError(null);
        const creds = await credentials();
        if (cancelled || room.state !== ConnectionState.Disconnected) return;
        await room.connect(creds.url, creds.token, connectOptions());
        if (cancelled) return;
        refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn’t join the room.");
        }
      }
    };
    void connect();
    return () => {
      cancelled = true;
      void room.disconnect();
    };
  }, [credentials, enabled, refresh, roomId, room]);

  React.useEffect(() => {
    if (!enabled || !roomId) return;
    const timer = window.setInterval(refresh, PRESENCE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh, roomId]);

  React.useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        hiddenSince.current = Date.now();
        window.setTimeout(() => {
          if (
            shouldDisconnectWhenHidden({
              hidden: document.hidden,
              onCall: onCallRef.current,
              hiddenForMs: hiddenSince.current ? Date.now() - hiddenSince.current : 0,
            })
          ) {
            void room.disconnect();
          }
        }, HIDDEN_DISCONNECT_MS + 50);
        return;
      }
      hiddenSince.current = null;
      if (enabled && roomId && room.state === ConnectionState.Disconnected) {
        void credentials()
          .then((creds) => {
            if (room.state !== ConnectionState.Disconnected) return;
            return room.connect(creds.url, creds.token, connectOptions());
          })
          .then(() => refresh())
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [credentials, enabled, refresh, roomId, room]);

  const publishChat = React.useCallback(() => {
    void room.localParticipant.publishData(encodePacket({ kind: "chat" }), { reliable: true });
  }, [room]);

  const publishCallPacket = React.useCallback(
    (packet: Exclude<CallPacket, { kind: "chat" }>) =>
      room.localParticipant.publishData(encodePacket(packet), { reliable: true }),
    [room],
  );

  /** Browsers refuse audio until a gesture; joining the call is that gesture. */
  const unlockAudio = React.useCallback(async () => {
    try {
      await room.startAudio();
      setAudioBlocked(!room.canPlaybackAudio);
    } catch {
      setAudioBlocked(true);
    }
  }, [room]);

  const joinCall = React.useCallback(async () => {
    await room.localParticipant.setAttributes({ oncall: "1" });
    await room.localParticipant.setMicrophoneEnabled(true);
    await unlockAudio();
    setOnCall(true);
    refresh();
  }, [refresh, room, unlockAudio]);

  const leaveCall = React.useCallback(async () => {
    await room.localParticipant.setMicrophoneEnabled(false);
    await room.localParticipant.setCameraEnabled(false);
    await room.localParticipant.setScreenShareEnabled(false);
    await room.localParticipant.setAttributes({ oncall: "0" });
    setOnCall(false);
    refresh();
  }, [refresh, room]);

  const toggleMic = React.useCallback(async () => {
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    refresh();
  }, [refresh, room]);

  const toggleCamera = React.useCallback(async () => {
    await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled);
    refresh();
  }, [refresh, room]);

  const toggleScreen = React.useCallback(async () => {
    await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled);
    refresh();
  }, [refresh, room]);

  const roster = splitRoster(participants);

  return {
    room,
    connection,
    connected: connection === ConnectionState.Connected,
    error,
    audioBlocked,
    unlockAudio,
    onCall,
    micEnabled,
    cameraEnabled,
    screenEnabled,
    inRoom: roster.inRoom,
    onCallRoster: roster.onCall,
    chatTick,
    callPacket,
    publishChat,
    publishCallPacket,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    toggleScreen,
    cameraTrack: room.localParticipant.getTrackPublication(Track.Source.Camera),
    micTrack: room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ?? null,
  };
}
