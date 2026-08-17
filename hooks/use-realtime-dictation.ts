"use client";

import * as React from "react";
import { audioConstraints } from "@/hooks/use-audio-inputs";
import {
  TARGET_SAMPLE_RATE,
  downsampleToRate,
  floatToPcm16,
  pcm16ToBase64,
} from "@/lib/dictation/pcm";
import {
  EMPTY_TRANSCRIPT_STATE,
  orderTranscriptItem,
  transcriptText,
  updateTranscript,
  type TranscriptState,
} from "@/lib/dictation/realtime-transcript";
import { transcriptionSessionConfig } from "@/lib/dictation/session";

const MAX_DICTATION_MS = 10 * 60 * 1_000;
const FINAL_TRANSCRIPT_QUIET_MS = 500;
const FINAL_TRANSCRIPT_WAIT_MS = 2_500;
const SOCKET_OPEN_MS = 10_000;
const PROCESSOR_BUFFER = 4096;
const REALTIME_SOCKET_URL =
  "wss://api.openai.com/v1/realtime?intent=transcription";

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

type CaptureHandle = { stop: () => void };

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const fromWindow = window.AudioContext;
  if (fromWindow) return fromWindow;
  const webkit = (
    window as unknown as { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;
  return webkit ?? null;
}

function waitForSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Live dictation timed out."));
    }, SOCKET_OPEN_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Live dictation couldn't connect."));
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("Live dictation closed before it opened."));
    };
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);
  });
}

function startPcmCapture(
  stream: MediaStream,
  onChunk: (base64: string) => void,
): CaptureHandle {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error("Audio capture isn't available here.");

  const context = new Ctor();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const resampled = downsampleToRate(
      input,
      context.sampleRate,
      TARGET_SAMPLE_RATE,
    );
    if (resampled.length === 0) return;
    onChunk(pcm16ToBase64(floatToPcm16(resampled)));
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);
  void context.resume();

  return {
    stop: () => {
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      silent.disconnect();
      void context.close();
    },
  };
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
  const socketRef = React.useRef<WebSocket | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const captureRef = React.useRef<CaptureHandle | null>(null);
  const transcriptRef = React.useRef<TranscriptState>(EMPTY_TRANSCRIPT_STATE);
  const previousItemsRef = React.useRef(new Map<string, string | null>());
  const lastTranscriptAtRef = React.useRef(0);
  const activeSessionRef = React.useRef(0);
  const listeningRef = React.useRef(false);
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = React.useRef<() => Promise<void>>(async () => undefined);

  React.useEffect(() => {
    setSupported(
      typeof WebSocket !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        Boolean(audioContextCtor()),
    );
  }, []);

  const clearMaxTimer = React.useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
  }, []);

  const releaseConnection = React.useCallback(() => {
    clearMaxTimer();
    captureRef.current?.stop();
    captureRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }, [clearMaxTimer]);

  const publish = React.useCallback(() => {
    callbackRef.current(transcriptText(transcriptRef.current));
    lastTranscriptAtRef.current = Date.now();
  }, []);

  const handleRealtimeEvent = React.useCallback(
    (raw: string) => {
      let message: RealtimeEvent;
      try {
        message = JSON.parse(raw) as RealtimeEvent;
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
        if (message.error?.code === "input_audio_buffer_commit_empty") return;
        setError(
          "Live dictation hit a connection problem. What you already said is kept.",
        );
      }
    },
    [publish],
  );

  const start = React.useCallback(async (): Promise<RealtimeDictationStart> => {
    if (
      typeof WebSocket === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !audioContextCtor()
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
      const response = await fetch("/api/assistant/realtime-transcription", {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        clientSecret?: string;
      } | null;
      if (!response.ok || !payload?.clientSecret) {
        throw new Error("Realtime session rejected.");
      }

      if (session !== activeSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return "failed";
      }

      const socket = new WebSocket(REALTIME_SOCKET_URL, [
        "realtime",
        `openai-insecure-api-key.${payload.clientSecret}`,
      ]);
      socketRef.current = socket;
      streamRef.current = stream;
      socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") handleRealtimeEvent(event.data);
      });
      socket.addEventListener("close", () => {
        if (session === activeSessionRef.current && listeningRef.current) {
          setError(
            "Live dictation lost its connection. What you already said is kept.",
          );
        }
      });

      await waitForSocketOpen(socket);
      if (session !== activeSessionRef.current) {
        releaseConnection();
        return "failed";
      }

      socket.send(
        JSON.stringify({
          type: "session.update",
          session: transcriptionSessionConfig(),
        }),
      );

      captureRef.current = startPcmCapture(stream, (audio) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({ type: "input_audio_buffer.append", audio }),
          );
        }
      });

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
    if (!socketRef.current || finalizing) return;
    listeningRef.current = false;
    setListening(false);
    setFinalizing(true);
    clearMaxTimer();

    captureRef.current?.stop();
    captureRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }

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
