"use client";

import * as React from "react";
import { useRealtimeDictation } from "@/hooks/use-realtime-dictation";
import { transcribeAssistantVoice } from "@/lib/api/assistant";

const MAX_DICTATION_MS = 10 * 60 * 1_000;

export type SpeechMode = "live" | "record" | "unavailable";

export type OriginSpeech = {
  mode: SpeechMode;
  listening: boolean;
  transcribing: boolean;
  error: string | null;
  micDenied: boolean;
  start: () => Promise<void>;
  finish: () => Promise<void>;
  clearError: () => void;
};

/**
 * Dictation shared by Origin, Passage, and Calendar. Server VAD creates phrase
 * boundaries without stopping the continuous WebRTC microphone session. If a
 * live session cannot connect, one complete recording is transcribed on Stop.
 */
export function useOriginSpeech(opts: {
  onTranscript: (text: string) => void;
  baseText: () => string;
}): OriginSpeech {
  const [mode, setMode] = React.useState<SpeechMode>("unavailable");
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [micDenied, setMicDenied] = React.useState(false);

  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const activeModeRef = React.useRef<"live" | "record" | null>(null);
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = React.useRef<() => Promise<void>>(async () => undefined);

  const mergeTranscript = React.useCallback((spoken: string) => {
    const base = optsRef.current.baseText().trim();
    optsRef.current.onTranscript(base ? `${base} ${spoken}`.trim() : spoken);
  }, []);

  const realtime = useRealtimeDictation({ onTranscript: mergeTranscript });

  React.useEffect(() => {
    if (realtime.supported) setMode("live");
    else if (typeof MediaRecorder !== "undefined") setMode("record");
    else setMode("unavailable");
  }, [realtime.supported]);

  const clearMaxTimer = React.useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
  }, []);

  const releaseStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMode("unavailable");
      setError("Voice input isn't available here. You can type instead.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(250);
      activeModeRef.current = "record";
      setRecording(true);
      setMode("record");
      return true;
    } catch (micError) {
      const name = micError instanceof DOMException ? micError.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setMicDenied(true);
      setError("TEMPO couldn't reach your microphone. You can type instead.");
      return false;
    }
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    setMicDenied(false);
    realtime.clearError();
    clearMaxTimer();

    const result = await realtime.start();
    if (result === "started") {
      activeModeRef.current = "live";
      setMode("live");
      maxTimerRef.current = setTimeout(() => void finishRef.current(), MAX_DICTATION_MS);
      return;
    }
    if (result === "mic-denied") {
      setMicDenied(true);
      return;
    }

    realtime.clearError();
    if (await startRecording()) {
      maxTimerRef.current = setTimeout(() => void finishRef.current(), MAX_DICTATION_MS);
    }
  }, [clearMaxTimer, realtime, startRecording]);

  const stopRecording = React.useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
          : null;
        chunksRef.current = [];
        recorderRef.current = null;
        resolve(blob);
      };
      if (recorder.state === "inactive") resolve(null);
      else recorder.stop();
    });
  }, []);

  const finish = React.useCallback(async () => {
    clearMaxTimer();
    const activeMode = activeModeRef.current;
    activeModeRef.current = null;

    if (activeMode === "live") {
      await realtime.finish();
      return;
    }
    if (activeMode !== "record") return;

    setRecording(false);
    const blob = await stopRecording();
    releaseStream();
    if (!blob || blob.size < 800) return;

    setTranscribing(true);
    try {
      const file = new File([blob], "dictation.webm", {
        type: blob.type || "audio/webm",
      });
      const spoken = await transcribeAssistantVoice(file);
      if (spoken.trim()) mergeTranscript(spoken.trim());
    } catch (transcriptionError) {
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : "That recording couldn't be transcribed. You can type instead.",
      );
    } finally {
      setTranscribing(false);
    }
  }, [clearMaxTimer, mergeTranscript, realtime, releaseStream, stopRecording]);

  finishRef.current = finish;

  const clearError = React.useCallback(() => {
    setError(null);
    realtime.clearError();
  }, [realtime]);

  React.useEffect(
    () => () => {
      clearMaxTimer();
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      releaseStream();
    },
    [clearMaxTimer, releaseStream],
  );

  return {
    mode,
    listening: realtime.listening || recording,
    transcribing: transcribing || realtime.finalizing,
    error: error ?? realtime.error,
    micDenied,
    start,
    finish,
    clearError,
  };
}
