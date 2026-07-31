"use client";

import * as React from "react";
import { transcribeAssistantVoice } from "@/lib/api/assistant";

/**
 * Speaking an introduction in ORIGIN.
 *
 * Same two-path architecture as Import's VoiceInput — live Web Speech where the
 * browser has it, MediaRecorder plus server transcription everywhere else — but
 * shaped for one long take rather than short chat turns: no forced stop, a
 * running elapsed clock, pause/resume, and a transcript that survives every
 * error path so nothing the artist said is ever lost.
 *
 * Raw audio is never retained. The recorded blob exists only long enough to be
 * transcribed, and is dropped immediately afterwards.
 */

type SpeechResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechEventLike = {
  resultIndex: number;
  results: { length: number } & Record<number, SpeechResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEventLike) => void) | null;
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

/** Comfortably past the ~30s the copy suggests, and inside the 25 MB API cap. */
const MAX_SECONDS = 10 * 60;

export type SpeechMode = "live" | "record" | "unavailable";

export type OriginSpeech = {
  mode: SpeechMode;
  listening: boolean;
  paused: boolean;
  elapsed: number;
  transcribing: boolean;
  error: string | null;
  /** Denied microphone permission — the manual path is the way forward. */
  micDenied: boolean;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  restart: () => void;
  clearError: () => void;
};

export function useOriginSpeech(opts: {
  /** Receives the full text heard so far, replacing the spoken portion. */
  onTranscript: (text: string) => void;
  /** Text already present before speaking began, preserved across restarts. */
  baseText: () => string;
}): OriginSpeech {
  const [mode, setMode] = React.useState<SpeechMode>("unavailable");
  const [listening, setListening] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [transcribing, setTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [micDenied, setMicDenied] = React.useState(false);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const finalRef = React.useRef("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = React.useRef(false);

  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  // Detected on mount — this only exists in the browser.
  React.useEffect(() => {
    if (getRecognitionCtor()) setMode("live");
    else if (typeof MediaRecorder !== "undefined") setMode("record");
    else setMode("unavailable");
  }, []);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= MAX_SECONDS) stopTimer();
        return s + 1;
      });
    }, 1000);
  }, [stopTimer]);

  /** Release the microphone. Called on every exit path. */
  const releaseStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startLive = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      const base = optsRef.current.baseText();
      const spoken = (finalRef.current + interim).trim();
      optsRef.current.onTranscript(base ? `${base} ${spoken}`.trim() : spoken);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicDenied(true);
        setError("TEMPO can't hear the microphone. You can type instead.");
        setListening(false);
        stopTimer();
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Dictation stopped unexpectedly. What you already said is kept.");
      }
    };
    recognition.onend = () => {
      // Chrome ends the session periodically; restart unless we asked it to stop.
      if (!stoppingRef.current && !micDenied) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      }
    };
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [micDenied, stopTimer]);

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      return true;
    } catch {
      setMicDenied(true);
      setError("TEMPO couldn't reach your microphone. You can type instead.");
      return false;
    }
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    stoppingRef.current = false;
    finalRef.current = "";
    setElapsed(0);

    const ok = mode === "live" ? startLive() : await startRecording();
    if (!ok) return;
    setListening(true);
    setPaused(false);
    startTimer();
  }, [mode, startLive, startRecording, startTimer]);

  const pause = React.useCallback(() => {
    if (!listening || paused) return;
    setPaused(true);
    stopTimer();
    if (mode === "live") {
      stoppingRef.current = true;
      recognitionRef.current?.stop();
    } else if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
    }
  }, [listening, paused, mode, stopTimer]);

  const resume = React.useCallback(async () => {
    if (!paused) return;
    setPaused(false);
    startTimer();
    if (mode === "live") {
      stoppingRef.current = false;
      // A fresh session continues appending to the same transcript.
      try {
        recognitionRef.current?.start();
      } catch {
        startLive();
      }
    } else if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
    }
  }, [paused, mode, startLive, startTimer]);

  const finish = React.useCallback(async () => {
    stoppingRef.current = true;
    stopTimer();
    setListening(false);
    setPaused(false);

    if (mode === "live") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    const recorder = recorderRef.current;
    if (!recorder) return;

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const parts = chunksRef.current;
        resolve(parts.length ? new Blob(parts, { type: recorder.mimeType || "audio/webm" }) : null);
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(null);
    });

    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    if (!blob) return;

    setTranscribing(true);
    try {
      const file = new File([blob], "origin-introduction.webm", { type: blob.type });
      const text = await transcribeAssistantVoice(file);
      const base = optsRef.current.baseText();
      optsRef.current.onTranscript(base ? `${base} ${text}`.trim() : text);
    } catch (err) {
      // The artist can still type — the flow must not dead-end here.
      setError(
        err instanceof Error
          ? err.message
          : "That recording couldn't be transcribed. You can type instead."
      );
    } finally {
      setTranscribing(false);
      // The recording itself is never kept beyond this point.
    }
  }, [mode, releaseStream, stopTimer]);

  const restart = React.useCallback(() => {
    stoppingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    finalRef.current = "";
    setListening(false);
    setPaused(false);
    setElapsed(0);
    setError(null);
  }, [releaseStream]);

  const clearError = React.useCallback(() => setError(null), []);

  /** Leaving the route must never leave the microphone open. */
  React.useEffect(
    () => () => {
      stoppingRef.current = true;
      recognitionRef.current?.abort();
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return {
    mode,
    listening,
    paused,
    elapsed,
    transcribing,
    error,
    micDenied,
    start,
    pause,
    resume,
    finish,
    restart,
    clearError,
  };
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
