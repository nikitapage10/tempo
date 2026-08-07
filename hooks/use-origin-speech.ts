"use client";

import * as React from "react";
import { transcribeAssistantVoice } from "@/lib/api/assistant";

/**
 * Lightweight dictation for Origin.
 *
 * Web Speech writes into the field as the artist talks. Browsers without it use
 * MediaRecorder and transcribe once the artist stops. Both paths use the same
 * interaction: tap the microphone to begin, tap it again to stop, or pause for
 * a few seconds and let Origin stop automatically.
 *
 * Raw audio is never retained. The fallback blob exists only long enough to be
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

const SILENCE_MS = 3_500;
const INITIAL_SILENCE_MS = 8_000;
const MAX_DICTATION_MS = 10 * 60 * 1_000;
const SPEECH_LEVEL = 0.025;

export type SpeechMode = "live" | "record" | "unavailable";

export type OriginSpeech = {
  mode: SpeechMode;
  listening: boolean;
  transcribing: boolean;
  error: string | null;
  /** Denied microphone permission, so typing remains the way forward. */
  micDenied: boolean;
  start: () => Promise<void>;
  finish: () => Promise<void>;
  clearError: () => void;
};

export function useOriginSpeech(opts: {
  /** Receives the full text heard so far, replacing the spoken portion. */
  onTranscript: (text: string) => void;
  /** Text already present before speaking began. */
  baseText: () => string;
}): OriginSpeech {
  const [mode, setMode] = React.useState<SpeechMode>("unavailable");
  const [listening, setListening] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [micDenied, setMicDenied] = React.useState(false);

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const finalRef = React.useRef("");
  const stoppingRef = React.useRef(false);
  const micDeniedRef = React.useRef(false);
  const finishRef = React.useRef<() => Promise<void>>(async () => undefined);
  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserFrameRef = React.useRef<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);

  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  React.useEffect(() => {
    if (getRecognitionCtor()) setMode("live");
    else if (typeof MediaRecorder !== "undefined") setMode("record");
    else setMode("unavailable");
  }, []);

  const clearStopTimers = React.useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const finishAfter = React.useCallback((delay: number) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => void finishRef.current(), delay);
  }, []);

  const stopAudioMonitor = React.useCallback(() => {
    if (analyserFrameRef.current !== null) cancelAnimationFrame(analyserFrameRef.current);
    analyserFrameRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const releaseStream = React.useCallback(() => {
    stopAudioMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [stopAudioMonitor]);

  const monitorRecordingSilence = React.useCallback(
    (stream: MediaStream) => {
      if (typeof AudioContext === "undefined") return;
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      const samples = new Uint8Array(analyser.fftSize);
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      audioContextRef.current = context;
      audioSourceRef.current = source;

      const sample = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const value = samples[i];
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        const level = Math.sqrt(sum / samples.length);
        if (level >= SPEECH_LEVEL) finishAfter(SILENCE_MS);
        analyserFrameRef.current = requestAnimationFrame(sample);
      };
      sample();
    },
    [finishAfter]
  );

  const startLive = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      const base = optsRef.current.baseText();
      const spoken = (finalRef.current + interim).trim();
      optsRef.current.onTranscript(base ? `${base} ${spoken}`.trim() : spoken);
      if (spoken) finishAfter(SILENCE_MS);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micDeniedRef.current = true;
        setMicDenied(true);
        setError("TEMPO can't hear the microphone. You can type instead.");
        setListening(false);
        clearStopTimers();
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Dictation stopped unexpectedly. What you already said is kept.");
      }
    };
    recognition.onend = () => {
      // Chrome periodically ends long sessions. Reopen it until the artist,
      // silence detector, or permission state deliberately ends dictation.
      if (!stoppingRef.current && !micDeniedRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          clearStopTimers();
        }
      }
    };
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [clearStopTimers, finishAfter]);

  const startRecording = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input isn't available in this browser. You can type instead.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      monitorRecordingSilence(stream);
      return true;
    } catch {
      micDeniedRef.current = true;
      setMicDenied(true);
      setError("TEMPO couldn't reach your microphone. You can type instead.");
      return false;
    }
  }, [monitorRecordingSilence]);

  const start = React.useCallback(async () => {
    setError(null);
    stoppingRef.current = false;
    micDeniedRef.current = false;
    finalRef.current = "";
    clearStopTimers();

    const ok = mode === "live" ? startLive() : mode === "record" ? await startRecording() : false;
    if (!ok) return;
    setListening(true);
    finishAfter(INITIAL_SILENCE_MS);
    maxTimerRef.current = setTimeout(() => void finishRef.current(), MAX_DICTATION_MS);
  }, [clearStopTimers, finishAfter, mode, startLive, startRecording]);

  const finish = React.useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearStopTimers();
    setListening(false);

    if (mode === "live") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    stopAudioMonitor();
    const recorder = recorderRef.current;
    if (!recorder) {
      releaseStream();
      return;
    }

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
      const file = new File([blob], "origin-dictation.webm", { type: blob.type });
      const text = await transcribeAssistantVoice(file);
      const base = optsRef.current.baseText();
      optsRef.current.onTranscript(base ? `${base} ${text}`.trim() : text);
    } catch (transcriptionError) {
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : "That recording couldn't be transcribed. You can type instead."
      );
    } finally {
      setTranscribing(false);
    }
  }, [clearStopTimers, mode, releaseStream, stopAudioMonitor]);

  finishRef.current = finish;

  const clearError = React.useCallback(() => setError(null), []);

  React.useEffect(
    () => () => {
      stoppingRef.current = true;
      clearStopTimers();
      recognitionRef.current?.abort();
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      releaseStream();
    },
    [clearStopTimers, releaseStream]
  );

  return {
    mode,
    listening,
    transcribing,
    error,
    micDenied,
    start,
    finish,
    clearError,
  };
}
