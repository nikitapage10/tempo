"use client";

import * as React from "react";
import { audioConstraints } from "@/hooks/use-audio-inputs";
import {
  EMPTY_TRANSCRIPT_STATE,
  orderTranscriptItem,
  transcriptText,
  updateTranscript,
  type TranscriptState,
} from "@/lib/dictation/realtime-transcript";

const MAX_DICTATION_MS = 10 * 60 * 1_000;
const FINAL_TRANSCRIPT_QUIET_MS = 500;
const FINAL_TRANSCRIPT_WAIT_MS = 2_500;

export type RealtimeDictationStart =
  | "started"
  | "unavailable"
  | "mic-denied"
  | "failed";

type RealtimeEvent = {
  type?: string;
  item_id?: string;
  previous_item_id?: string | null;
  delta?: string;
  transcript?: string;
  item?: { id?: string };
  error?: { code?: string; message?: string };
};

function waitForDataChannel(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Realtime data channel timed out."));
    }, 8_000);
    const cleanup = () => {
      clearTimeout(timeout);
      channel.removeEventListener("open", handleOpen);
      channel.removeEventListener("close", handleClose);
      channel.removeEventListener("error", handleError);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("Realtime data channel closed."));
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Realtime data channel failed."));
    };
    channel.addEventListener("open", handleOpen);
    channel.addEventListener("close", handleClose);
    channel.addEventListener("error", handleError);
  });
}

export function useRealtimeDictation({
  onTranscript,
  deviceId = null,
}: {
  onTranscript: (text: string) => void;
  deviceId?: string | null;
}) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const callbackRef = React.useRef(onTranscript);
  callbackRef.current = onTranscript;
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const channelRef = React.useRef<RTCDataChannel | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const transcriptRef = React.useRef<TranscriptState>(EMPTY_TRANSCRIPT_STATE);
  const previousItemsRef = React.useRef(new Map<string, string | null>());
  const lastTranscriptAtRef = React.useRef(0);
  const activeSessionRef = React.useRef(0);
  const listeningRef = React.useRef(false);
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = React.useRef<() => Promise<void>>(async () => undefined);

  React.useEffect(() => {
    setSupported(
      typeof RTCPeerConnection !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  const clearMaxTimer = React.useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
  }, []);

  const releaseConnection = React.useCallback(() => {
    clearMaxTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && channel.readyState !== "closed") channel.close();
    const peer = peerRef.current;
    peerRef.current = null;
    if (peer && peer.connectionState !== "closed") peer.close();
  }, [clearMaxTimer]);

  const publish = React.useCallback(() => {
    callbackRef.current(transcriptText(transcriptRef.current));
    lastTranscriptAtRef.current = Date.now();
  }, []);

  const handleRealtimeEvent = React.useCallback(
    (event: MessageEvent<string>) => {
      let message: RealtimeEvent;
      try {
        message = JSON.parse(event.data) as RealtimeEvent;
      } catch {
        return;
      }

      if (message.type === "input_audio_buffer.committed" && message.item_id) {
        previousItemsRef.current.set(
          message.item_id,
          message.previous_item_id ?? null,
        );
        transcriptRef.current = orderTranscriptItem(
          transcriptRef.current,
          message.item_id,
          message.previous_item_id,
        );
        publish();
        return;
      }

      if (message.type === "conversation.item.created" && message.item?.id) {
        previousItemsRef.current.set(
          message.item.id,
          message.previous_item_id ?? null,
        );
        transcriptRef.current = orderTranscriptItem(
          transcriptRef.current,
          message.item.id,
          message.previous_item_id,
        );
        publish();
        return;
      }

      if (
        message.type ===
          "conversation.item.input_audio_transcription.delta" &&
        message.item_id &&
        typeof message.delta === "string"
      ) {
        transcriptRef.current = updateTranscript(transcriptRef.current, {
          itemId: message.item_id,
          text: message.delta,
          kind: "delta",
          previousItemId: previousItemsRef.current.get(message.item_id),
        });
        publish();
        return;
      }

      if (
        message.type ===
          "conversation.item.input_audio_transcription.completed" &&
        message.item_id
      ) {
        transcriptRef.current = updateTranscript(transcriptRef.current, {
          itemId: message.item_id,
          text: message.transcript ?? "",
          kind: "completed",
          previousItemId: previousItemsRef.current.get(message.item_id),
        });
        publish();
        return;
      }

      if (message.type === "error") {
        // A final commit after server VAD has already committed the phrase is
        // harmless; the Realtime API reports it as an empty-buffer error.
        if (message.error?.code === "input_audio_buffer_commit_empty") return;
        setError("Live dictation hit a connection problem. What you already said is kept.");
      }
    },
    [publish],
  );

  const start = React.useCallback(async (): Promise<RealtimeDictationStart> => {
    if (
      typeof RTCPeerConnection === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return "unavailable";
    }

    activeSessionRef.current += 1;
    const session = activeSessionRef.current;
    releaseConnection();
    transcriptRef.current = EMPTY_TRANSCRIPT_STATE;
    previousItemsRef.current.clear();
    lastTranscriptAtRef.current = Date.now();
    setError(null);
    setFinalizing(false);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(deviceId),
      });
    } catch (micError) {
      const name = micError instanceof DOMException ? micError.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("TEMPO couldn't reach your microphone. Check its permission.");
        return "mic-denied";
      }
      setError("TEMPO couldn't open that microphone.");
      return "failed";
    }

    if (session !== activeSessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return "failed";
    }

    try {
      const peer = new RTCPeerConnection();
      const channel = peer.createDataChannel("oai-events");
      peerRef.current = peer;
      channelRef.current = channel;
      streamRef.current = stream;
      channel.addEventListener("message", handleRealtimeEvent);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.addEventListener("connectionstatechange", () => {
        if (
          session === activeSessionRef.current &&
          (peer.connectionState === "failed" ||
            peer.connectionState === "disconnected")
        ) {
          setError("Live dictation lost its connection. What you already said is kept.");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/assistant/realtime-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp ?? "",
      });
      if (!response.ok) throw new Error("Realtime session rejected.");
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      await waitForDataChannel(channel);

      if (session !== activeSessionRef.current) {
        releaseConnection();
        return "failed";
      }

      listeningRef.current = true;
      setListening(true);
      maxTimerRef.current = setTimeout(
        () => void finishRef.current(),
        MAX_DICTATION_MS,
      );
      return "started";
    } catch {
      releaseConnection();
      setError("Live dictation couldn't connect.");
      return "failed";
    }
  }, [deviceId, handleRealtimeEvent, releaseConnection]);

  const finish = React.useCallback(async () => {
    if (!peerRef.current || finalizing) return;
    listeningRef.current = false;
    setListening(false);
    setFinalizing(true);
    clearMaxTimer();

    const channel = channelRef.current;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const started = Date.now();
    while (
      Date.now() - started < FINAL_TRANSCRIPT_WAIT_MS &&
      (Date.now() - started < FINAL_TRANSCRIPT_QUIET_MS ||
        Date.now() - lastTranscriptAtRef.current < FINAL_TRANSCRIPT_QUIET_MS)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 75));
    }

    activeSessionRef.current += 1;
    releaseConnection();
    setFinalizing(false);
  }, [clearMaxTimer, finalizing, releaseConnection]);

  finishRef.current = finish;

  const clearError = React.useCallback(() => setError(null), []);

  React.useEffect(
    () => () => {
      activeSessionRef.current += 1;
      listeningRef.current = false;
      releaseConnection();
    },
    [releaseConnection],
  );

  return {
    supported,
    listening,
    finalizing,
    error,
    start,
    finish,
    clearError,
  };
}
