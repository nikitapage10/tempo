"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { audioConstraints } from "@/hooks/use-audio-inputs";
import { useRealtimeDictation } from "@/hooks/use-realtime-dictation";
import { cn } from "@/lib/utils";

type VoiceInputProps = {
  /** Called continuously with everything heard in this dictation. */
  onTranscript: (accumulated: string) => void;
  /** Fired when dictation begins, so the composer can snapshot what's typed. */
  onStart: () => void;
  /** Safety fallback when a Realtime session cannot be opened. */
  onRecorded: (file: File) => void;
  disabled?: boolean;
  deviceId?: string | null;
};

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * Shared dictation control for Import, Messages, and the assistant. Realtime
 * WebRTC is the normal path on both browsers and desktop. If it cannot connect,
 * one uninterrupted recording is transcribed after Stop.
 */
export function VoiceInput({
  onTranscript,
  onStart,
  onRecorded,
  disabled,
  deviceId = null,
}: VoiceInputProps) {
  const [recording, setRecording] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [activeMode, setActiveMode] = React.useState<"live" | "record" | null>(null);

  const realtime = useRealtimeDictation({ onTranscript, deviceId });
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = React.useRef(0);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const beginTimer = React.useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1_000));
    }, 1_000);
  }, [stopTimer]);

  const startFallback = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input isn't available here. Type it out instead.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(deviceId),
      });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        recorderRef.current = null;
        if (blob.size > 0) {
          onRecorded(
            new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type }),
          );
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setActiveMode("record");
      return true;
    } catch {
      setError("TEMPO couldn't reach your microphone. Check its permission.");
      return false;
    }
  }, [deviceId, onRecorded]);

  const start = React.useCallback(async () => {
    setStarting(true);
    setError(null);
    realtime.clearError();
    onStart();

    const result = await realtime.start();
    if (result === "started") {
      setActiveMode("live");
      beginTimer();
      setStarting(false);
      return;
    }
    if (result === "mic-denied") {
      setStarting(false);
      return;
    }

    realtime.clearError();
    const fallbackStarted = await startFallback();
    if (fallbackStarted) beginTimer();
    setStarting(false);
  }, [beginTimer, onStart, realtime, startFallback]);

  const stop = React.useCallback(async () => {
    stopTimer();
    if (activeMode === "live") await realtime.finish();
    else {
      setRecording(false);
      recorderRef.current?.stop();
    }
    setActiveMode(null);
  }, [activeMode, realtime, stopTimer]);

  React.useEffect(
    () => () => {
      stopTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorder.stop();
      }
    },
    [stopTimer],
  );

  const listening = realtime.listening || recording;
  const displayError = error ?? realtime.error;
  const liveActive = activeMode === "live";

  return (
    <button
      type="button"
      aria-label={
        listening
          ? `Stop ${liveActive ? "dictation" : "recording"} (${formatElapsed(elapsed)})`
          : "Talk instead of typing"
      }
      title={
        displayError ||
        (listening
          ? "Stop"
          : realtime.supported
            ? "Talk — your words appear here as you speak"
            : "Record a voice note")
      }
      disabled={disabled || starting || realtime.finalizing}
      onClick={listening ? () => void stop() : () => void start()}
      className={cn(
        "flex items-center gap-1.5 rounded-input p-2 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40",
        listening ? "text-warn" : "text-text-lo hover:text-ice",
      )}
    >
      {listening ? (
        <>
          <Square className="size-4 fill-current" />
          <span className="font-data text-xs tabular-nums">{formatElapsed(elapsed)}</span>
        </>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
