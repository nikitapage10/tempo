"use client";

import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, MessageSquarePlus } from "lucide-react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { Button } from "@/components/ui/button";
import { useComments, useCommentMutations } from "@/hooks/use-comments";
import { useVersions } from "@/hooks/use-versions";
import type { CallPacket } from "@/lib/calls/protocol";
import {
  expectedTransportPosition,
  shouldCorrectTransport,
} from "@/lib/calls/transport-sync";
import { formatDuration } from "@/lib/format";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { getSignedUrl, peekSignedUrl } from "@/lib/storage";

type RemotePacket = {
  packet: Exclude<CallPacket, { kind: "chat" }>;
  fromIdentity: string | null;
  receivedAtMs: number;
} | null;

export function SessionDeck({
  roomId,
  trackId,
  localIdentity,
  callPacket,
  publish,
  guest = false,
}: {
  roomId: string;
  trackId: string | null;
  localIdentity: string | null;
  callPacket: RemotePacket;
  publish?: (packet: Exclude<CallPacket, { kind: "chat" }>) => Promise<unknown> | void;
  guest?: boolean;
}) {
  const palette = useActiveArtistPalette();
  const queryClient = useQueryClient();
  const versions = useVersions(guest ? null : trackId);
  const current = versions.data?.find((version) => version.is_current) ?? versions.data?.[0] ?? null;
  const [versionId, setVersionId] = React.useState<string | null>(null);
  const selected = versions.data?.find((version) => version.id === versionId) ?? current;
  const comments = useComments(guest ? null : trackId, selected?.id ?? "all");
  const commentMutations = useCommentMutations(trackId, selected?.id ?? "all");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const pendingRemote = React.useRef<RemotePacket>(null);
  const suppressPublish = React.useRef(false);
  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const guestTransport = React.useRef<{ positionSec: number; playing: boolean; receivedAtMs: number } | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [note, setNote] = React.useState("");
  const playbackId = `session-deck:${roomId}`;

  React.useEffect(() => {
    if (!versionId && current) setVersionId(current.id);
  }, [current, versionId]);

  const publishTransport = React.useCallback(
    (ws: WaveSurfer, overridePlaying?: boolean) => {
      if (!selected || suppressPublish.current || !publish) return;
      void publish({
        kind: "transport",
        versionId: selected.id,
        positionSec: ws.getCurrentTime(),
        playing: overridePlaying ?? ws.isPlaying(),
        atMs: Date.now(),
      });
    },
    [publish, selected],
  );

  const applyRemote = React.useCallback((remote: RemotePacket) => {
    if (!remote || remote.packet.kind !== "transport") return;
    if (remote.fromIdentity && remote.fromIdentity === localIdentity) return;
    if (remote.packet.versionId !== versionId) {
      pendingRemote.current = remote;
      setVersionId(remote.packet.versionId);
      return;
    }
    const ws = wsRef.current;
    if (!ws) {
      pendingRemote.current = remote;
      return;
    }
    const expected = expectedTransportPosition(
      remote.packet.positionSec,
      remote.packet.playing,
      Date.now(),
      remote.receivedAtMs,
    );
    suppressPublish.current = true;
    if (shouldCorrectTransport(ws.getCurrentTime(), expected)) ws.setTime(expected);
    if (remote.packet.playing && !ws.isPlaying()) void ws.play();
    if (!remote.packet.playing && ws.isPlaying()) ws.pause();
    window.setTimeout(() => {
      suppressPublish.current = false;
    }, 0);
  }, [localIdentity, versionId]);

  React.useEffect(() => {
    if (guest) {
      if (callPacket?.packet.kind === "transport") {
        guestTransport.current = {
          positionSec: callPacket.packet.positionSec,
          playing: callPacket.packet.playing,
          receivedAtMs: callPacket.receivedAtMs,
        };
        setPosition(callPacket.packet.positionSec);
      }
      return;
    }
    if (callPacket?.fromIdentity && callPacket.fromIdentity === localIdentity) return;
    if (callPacket?.packet.kind === "deck") {
      setVersionId(callPacket.packet.versionId);
      return;
    }
    if (callPacket?.packet.kind === "marker") {
      void queryClient.invalidateQueries({ queryKey: ["comments", trackId] });
      return;
    }
    applyRemote(callPacket);
  }, [applyRemote, callPacket, guest, localIdentity, queryClient, trackId]);

  React.useEffect(() => {
    if (!guest) return;
    const timer = window.setInterval(() => {
      const transport = guestTransport.current;
      if (!transport) return;
      setPosition(
        expectedTransportPosition(
          transport.positionSec,
          transport.playing,
          Date.now(),
          transport.receivedAtMs,
        ),
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [guest]);

  React.useEffect(() => {
    if (guest || !containerRef.current || !selected) return;
    let cancelled = false;
    setReady(false);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: palette.gray,
      progressColor: palette.ice,
      cursorColor: palette.amber,
      height: 72,
      barWidth: 2,
      barGap: 1,
      normalize: true,
    });
    wsRef.current = ws;
    const unregister = playbackCoordinator.register(playbackId, () => ws.pause());
    ws.on("ready", () => {
      if (cancelled) return;
      setReady(true);
      setDuration(ws.getDuration());
      const remote = pendingRemote.current;
      pendingRemote.current = null;
      if (remote) applyRemote(remote);
    });
    ws.on("timeupdate", setPosition);
    ws.on("play", () => {
      setPlaying(true);
      playbackCoordinator.notifyPlay(playbackId);
      publishTransport(ws, true);
    });
    ws.on("pause", () => {
      setPlaying(false);
      playbackCoordinator.notifyStop(playbackId);
      publishTransport(ws, false);
    });
    ws.on("interaction", () => publishTransport(ws));
    const cached = peekSignedUrl(selected.file_url);
    (cached ? Promise.resolve(cached) : getSignedUrl(selected.file_url))
      .then((url) => ws.load(url))
      .catch(() => {});
    return () => {
      cancelled = true;
      unregister();
      ws.destroy();
      wsRef.current = null;
    };
  }, [applyRemote, guest, palette.amber, palette.gray, palette.ice, playbackId, publishTransport, selected]);

  React.useEffect(() => {
    if (!playing || guest) return;
    const timer = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws) publishTransport(ws, true);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [guest, playing, publishTransport]);

  if (!trackId) {
    return <div className="well flex h-24 items-center justify-center text-sm text-text-lo">Choose a song to put a bounce on the deck.</div>;
  }

  if (guest) {
    return (
      <div className="well flex h-20 items-center justify-between px-4">
        <span className="text-xs text-text-lo">The shared deck</span>
        <span className="font-data text-sm text-amber">{formatDuration(position)}</span>
      </div>
    );
  }

  if (!selected) {
    return <div className="well flex h-24 items-center justify-center text-sm text-text-lo">Nothing to play yet. Upload a bounce on the track.</div>;
  }

  const markers = (comments.data ?? []).filter((comment) => comment.timestamp_sec != null);
  return (
    <div className="well relative overflow-hidden p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <select
          aria-label="Bounce on the deck"
          className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs"
          value={selected.id}
          onChange={(event) => {
            setVersionId(event.target.value);
            void publish?.({ kind: "deck", versionId: event.target.value, byIdentity: localIdentity ?? "" });
          }}
        >
          {(versions.data ?? []).map((version) => (
            <option key={version.id} value={version.id}>v{version.version_no}{version.label ? ` · ${version.label}` : ""}</option>
          ))}
        </select>
        <span className="font-data text-xs text-text-lo">{formatDuration(position)} / {formatDuration(duration)}</span>
      </div>
      <div className="relative">
        <div ref={containerRef} role="slider" aria-label="Shared bounce playhead" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={position} />
        {duration > 0 ? markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            title={marker.text}
            className="absolute top-0 h-full w-0.5 bg-amber"
            style={{ left: `${Math.min(100, ((marker.timestamp_sec ?? 0) / duration) * 100)}%` }}
            onClick={() => wsRef.current?.setTime(marker.timestamp_sec ?? 0)}
          />
        )) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" disabled={!ready} onClick={() => void wsRef.current?.playPause()}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Drop a note here"
          className="h-9 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!note.trim()}
          onClick={() => {
            if (!selected || !note.trim()) return;
            void commentMutations.create
              .mutateAsync({ versionId: selected.id, text: note.trim(), timestampSec: position })
              .then((comment) => {
                setNote("");
                void publish?.({
                  kind: "marker",
                  commentId: comment.id,
                  versionId: selected.id,
                  timestampSec: position,
                });
              });
          }}
        >
          <MessageSquarePlus className="size-4" />
          Drop note
        </Button>
      </div>
    </div>
  );
}
