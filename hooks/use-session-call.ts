"use client";

import * as React from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import {
  HIDDEN_DISCONNECT_MS,
  shouldDisconnectWhenHidden,
} from "@/lib/sessions/livekit-room";
import { splitRoster, type SessionPresenceParticipant } from "@/lib/sessions/presence";

type CallToken = { token: string; url: string; roomName: string };

async function fetchMemberToken(roomId: string): Promise<CallToken> {
  const response = await fetch(`/api/sessions/${roomId}/livekit-token`, { method: "POST" });
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
          attributes: room.localParticipant.attributes,
          isLocal: true,
        },
      ]
    : [];
  const remotes: SessionPresenceParticipant[] = Array.from(room.remoteParticipants.values()).map(
    (participant) => ({
      identity: participant.identity,
      attributes: participant.attributes,
      isLocal: false,
    })
  );
  return [...locals, ...remotes];
}

export function useSessionCall(input: {
  roomId: string | null;
  enabled: boolean;
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
  const [chatTick, setChatTick] = React.useState(0);
  const hiddenSince = React.useRef<number | null>(null);
  const onCallRef = React.useRef(false);
  const fetchToken = input.fetchToken;

  React.useEffect(() => {
    onCallRef.current = onCall;
  }, [onCall]);

  const refresh = React.useCallback(() => {
    setParticipants(snapshot(room));
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setScreenEnabled(room.localParticipant.isScreenShareEnabled);
  }, [room]);

  React.useEffect(() => {
    const bump = () => refresh();
    const onData = (payload: Uint8Array) => {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as { kind?: string };
        if (parsed.kind === "chat") setChatTick((value) => value + 1);
      } catch {
        /* ignore non-json packets */
      }
    };
    room.on(RoomEvent.ParticipantConnected, bump);
    room.on(RoomEvent.ParticipantDisconnected, bump);
    room.on(RoomEvent.ParticipantAttributesChanged, bump);
    room.on(RoomEvent.TrackSubscribed, bump);
    room.on(RoomEvent.TrackUnsubscribed, bump);
    room.on(RoomEvent.LocalTrackPublished, bump);
    room.on(RoomEvent.LocalTrackUnpublished, bump);
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      setConnection(state);
      bump();
    });
    return () => {
      room.removeAllListeners();
    };
  }, [refresh, room]);

  React.useEffect(() => {
    if (!input.enabled || !input.roomId) return;
    let cancelled = false;
    const connect = async () => {
      try {
        setError(null);
        const creds = fetchToken ? await fetchToken() : await fetchMemberToken(input.roomId!);
        if (cancelled) return;
        await room.connect(creds.url, creds.token, connectOptions());
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
  }, [fetchToken, input.enabled, input.roomId, refresh, room]);

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
      if (input.enabled && input.roomId && room.state === ConnectionState.Disconnected) {
        const reconnect = fetchToken ? fetchToken : () => fetchMemberToken(input.roomId!);
        void reconnect()
          .then((creds) => room.connect(creds.url, creds.token, connectOptions()))
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchToken, input.enabled, input.roomId, room]);

  const publishChat = React.useCallback(() => {
    const payload = new TextEncoder().encode(JSON.stringify({ kind: "chat" }));
    void room.localParticipant.publishData(payload, { reliable: true });
  }, [room]);

  const joinCall = React.useCallback(async () => {
    await room.localParticipant.setAttributes({ oncall: "1" });
    await room.localParticipant.setMicrophoneEnabled(true);
    setOnCall(true);
    refresh();
  }, [refresh, room]);

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
    error,
    onCall,
    micEnabled,
    cameraEnabled,
    screenEnabled,
    inRoom: roster.inRoom,
    onCallRoster: roster.onCall,
    chatTick,
    publishChat,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    toggleScreen,
    cameraTrack: room.localParticipant.getTrackPublication(Track.Source.Camera),
  };
}
