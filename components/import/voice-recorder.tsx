"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoiceRecorderProps = {
  onRecorded: (file: File) => void;
  disabled?: boolean;
  /** Icon-only, for sitting in a chat composer beside the send button. */
  compact?: boolean;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Hold-to-talk for the intake screen. Records with MediaRecorder and hands back
 * a file; transcription happens server-side.
 */
export function VoiceRecorder({ onRecorded, disabled, compact }: VoiceRecorderProps) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Don't leave the mic open if the artist navigates away mid-recording.
  React.useEffect(() => {
    return () => {
      stopTimer();
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stream.getTracks().forEach((t) => t.stop());
        rec.stop();
      }
    };
  }, [stopTimer]);

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio. Type it out instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        onRecorded(new File([blob], `voice-note-${stamp}.${ext}`, { type }));
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch {
      setError("TEMPO couldn't reach your microphone. Check permissions, or type it out.");
    }
  }

  function stop() {
    stopTimer();
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }

  if (compact) {
    // Sits inline in the composer, so it can't take a button's worth of width.
    // While recording it grows just enough to show the running time.
    return (
      <button
        type="button"
        aria-label={recording ? `Stop recording (${formatElapsed(elapsed)})` : "Record a voice note"}
        title={error || (recording ? "Stop recording" : "Record a voice note")}
        disabled={disabled}
        onClick={recording ? stop : () => void start()}
        className={cn(
          "flex items-center gap-1.5 rounded-input p-2 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40",
          recording ? "text-warn" : "text-text-lo hover:text-ice",
        )}
      >
        {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />}
        {recording ? (
          <span className="font-data text-xs tabular-nums">{formatElapsed(elapsed)}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant={recording ? "destructive" : "secondary"}
        disabled={disabled}
        onClick={recording ? stop : () => void start()}
        className="w-full"
      >
        {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        {recording ? `Stop · ${formatElapsed(elapsed)}` : "Record a voice note"}
      </Button>

      {recording ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-text-lo">
          <span
            className={cn("inline-block size-2 rounded-full bg-warn", "animate-pulse")}
            aria-hidden
          />
          Talk through what you&rsquo;re working on — names, stages, what&rsquo;s stuck.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
