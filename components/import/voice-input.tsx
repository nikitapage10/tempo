"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal shape of the Web Speech API. It isn't in lib.dom, and Chrome still
 * only exposes the webkit-prefixed constructor.
 */
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number } & Record<number, SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type VoiceInputProps = {
  /** Called as speech is recognised, with everything heard in this dictation. */
  onTranscript: (accumulated: string) => void;
  /** Fired when dictation begins, so the composer can snapshot what's typed. */
  onStart: () => void;
  /** Fallback path: browsers without Web Speech still record and upload. */
  onRecorded: (file: File) => void;
  disabled?: boolean;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Talking into the import chat.
 *
 * Where the browser supports it, speech goes straight into the composer as text
 * so the artist can fix a mangled song title before sending — the thing that
 * matters most here, since names are exactly what gets misheard. Browsers
 * without the API fall back to recording a note and transcribing it server-side.
 */
export function VoiceInput({ onTranscript, onStart, onRecorded, disabled }: VoiceInputProps) {
  const [listening, setListening] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [supportsLive, setSupportsLive] = React.useState(false);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const finalRef = React.useRef("");
  const stoppingRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = React.useRef(0);

  // Detected on mount, not at module scope — this only runs in the browser.
  React.useEffect(() => {
    setSupportsLive(getRecognitionCtor() !== null);
  }, []);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Releasing the mic matters — the browser shows a recording indicator until
  // every track is stopped.
  React.useEffect(() => {
    return () => {
      stopTimer();
      stoppingRef.current = true;
      recognitionRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((t) => t.stop());
        recorder.stop();
      }
    };
  }, [stopTimer]);

  function beginTimer() {
    startedAtRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }

  function startLive() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    finalRef.current = "";
    stoppingRef.current = false;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = result[0].transcript;
        if (result.isFinal) finalRef.current += chunk;
        else interim += chunk;
      }
      // Interim words are shown too, so it feels live rather than laggy — they
      // get replaced as soon as the engine settles on them.
      onTranscript((finalRef.current + interim).trim());
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("TEMPO couldn’t reach your microphone. Check the browser’s permission.");
        stoppingRef.current = true;
        setListening(false);
        stopTimer();
      }
      // "no-speech" and "aborted" are normal; onend handles restarting.
    };

    recognition.onend = () => {
      // Chrome ends the session on a pause. Restart until the artist stops.
      if (!stoppingRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through to stopping */
        }
      }
      setListening(false);
      stopTimer();
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }

  async function startFallback() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can’t record audio. Type it out instead.");
      return false;
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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          onRecorded(
            new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type }),
          );
        }
        chunksRef.current = [];
        recorderRef.current = null;
      };

      recorderRef.current = recorder;
      recorder.start();
      return true;
    } catch {
      setError("TEMPO couldn’t reach your microphone. Check the browser’s permission.");
      return false;
    }
  }

  async function start() {
    setError(null);
    onStart();

    const started = supportsLive ? startLive() : await startFallback();
    if (started) {
      setListening(true);
      beginTimer();
    }
  }

  function stop() {
    stoppingRef.current = true;
    stopTimer();
    setListening(false);
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
  }

  return (
    <button
      type="button"
      aria-label={
        listening
          ? `Stop ${supportsLive ? "dictation" : "recording"} (${formatElapsed(elapsed)})`
          : supportsLive
            ? "Talk instead of typing"
            : "Record a voice note"
      }
      title={
        error ||
        (listening
          ? "Stop"
          : supportsLive
            ? "Talk — your words appear in the box so you can fix them"
            : "Record a voice note")
      }
      disabled={disabled}
      onClick={listening ? stop : () => void start()}
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
