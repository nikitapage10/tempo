"use client";

import * as React from "react";
import { transcribeAssistantVoice } from "@/lib/api/assistant";
import { isDesktopApp } from "@/lib/desktop/bridge";

/**
 * Lightweight dictation for Origin.
 *
 * Web Speech writes into the field as the artist talks. Desktop (and browsers
 * without Web Speech) use MediaRecorder. Electron's SpeechRecognition usually
 * dies with a `network` error, so desktop prefers recording — but it still
 * flushes short spoken phrases while listening and transcribes them in the
 * background, so text appears live instead of only after Stop.
 *
 * Raw audio is never retained. Segment blobs exist only long enough to be
 * transcribed, and are dropped immediately afterwards.
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
/** After a pause in speech, flush the current recording segment for live text. */
const SEGMENT_FLUSH_MS = 600;
/** Force a flush during continuous talk so phrases don't wait for a long pause. */
const MAX_SEGMENT_MS = 2_400;
/**
 * The first segment is cut short deliberately.
 *
 * On the recording path nothing can appear until a segment has been closed,
 * uploaded and transcribed, so the opening words set the impression of whether
 * dictation is working at all. A short first cut puts something on screen in
 * about a second; every segment after it can be long enough to give the
 * transcriber proper phrases to work with.
 */
const FIRST_SEGMENT_MS = 1_200;
/**
 * Silence is sampled on a timer, not every animation frame. At 60fps this loop
 * ran an RMS pass over 2048 samples on the same main thread as ORIGIN's film,
 * and it only has to notice speech within a fraction of the flush window.
 */
const LEVEL_SAMPLE_MS = 60;

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
  const segmentFlushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentMaxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const hadSpeechInSegmentRef = React.useRef(false);
  const firstSegmentRef = React.useRef(true);
  const flushingSegmentRef = React.useRef(false);
  const listeningRef = React.useRef(false);
  const segmentSeqRef = React.useRef(0);
  const applySeqRef = React.useRef(0);
  const pendingTextRef = React.useRef(new Map<number, string>());
  const inFlightRef = React.useRef(0);

  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  React.useEffect(() => {
    // Electron exposes webkitSpeechRecognition, but Google's cloud STT usually
    // fails with `network` there — same trap Import's VoiceInput already avoids.
    // Prefer MediaRecorder → /api/assistant/transcribe on desktop, with live
    // phrase flushes so the field fills while listening.
    const allowLive = !isDesktopApp() && getRecognitionCtor();
    if (allowLive) setMode("live");
    else if (typeof MediaRecorder !== "undefined") setMode("record");
    else setMode("unavailable");
  }, []);

  const clearStopTimers = React.useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (segmentFlushTimerRef.current) clearTimeout(segmentFlushTimerRef.current);
    if (segmentMaxTimerRef.current) clearTimeout(segmentMaxTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
    segmentFlushTimerRef.current = null;
    segmentMaxTimerRef.current = null;
  }, []);

  const finishAfter = React.useCallback((delay: number) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => void finishRef.current(), delay);
  }, []);

  const publishSpoken = React.useCallback(() => {
    const base = optsRef.current.baseText();
    const spoken = finalRef.current.trim();
    optsRef.current.onTranscript(base ? `${base} ${spoken}`.trim() : spoken);
  }, []);

  const applyPendingSegments = React.useCallback(() => {
    while (pendingTextRef.current.has(applySeqRef.current)) {
      const text = pendingTextRef.current.get(applySeqRef.current) ?? "";
      pendingTextRef.current.delete(applySeqRef.current);
      applySeqRef.current += 1;
      if (!text) continue;
      finalRef.current = `${finalRef.current} ${text}`.trim();
      publishSpoken();
    }
  }, [publishSpoken]);

  const queueSegmentTranscription = React.useCallback(
    (blob: Blob) => {
      if (blob.size < 800) return;
      const seq = segmentSeqRef.current;
      segmentSeqRef.current += 1;
      inFlightRef.current += 1;
      setTranscribing(true);
      const file = new File([blob], `origin-dictation-${seq}.webm`, {
        type: blob.type || "audio/webm",
      });
      void transcribeAssistantVoice(file)
        .then((text) => {
          pendingTextRef.current.set(seq, text.trim());
          applyPendingSegments();
        })
        .catch(() => {
          // Keep listening; a missed phrase shouldn't kill the whole pass.
          pendingTextRef.current.set(seq, "");
          applyPendingSegments();
        })
        .finally(() => {
          inFlightRef.current = Math.max(0, inFlightRef.current - 1);
          if (inFlightRef.current === 0) setTranscribing(false);
        });
    },
    [applyPendingSegments]
  );

  const stopAudioMonitor = React.useCallback(() => {
    if (analyserTimerRef.current !== null) clearInterval(analyserTimerRef.current);
    analyserTimerRef.current = null;
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

  const stopCurrentRecorder = React.useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const parts = chunksRef.current;
        chunksRef.current = [];
        resolve(parts.length ? new Blob(parts, { type: recorder.mimeType || "audio/webm" }) : null);
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(null);
    });
    recorderRef.current = null;
    return blob;
  }, []);

  const beginRecorderSegment = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream || stoppingRef.current || !listeningRef.current) return false;
    if (typeof MediaRecorder === "undefined") return false;
    try {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      hadSpeechInSegmentRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      // Timeslice so a quick stop still has bytes to transcribe.
      recorder.start(250);
      if (segmentMaxTimerRef.current) clearTimeout(segmentMaxTimerRef.current);
      const cap = firstSegmentRef.current ? FIRST_SEGMENT_MS : MAX_SEGMENT_MS;
      firstSegmentRef.current = false;
      segmentMaxTimerRef.current = setTimeout(() => {
        if (hadSpeechInSegmentRef.current) void flushSegmentRef.current();
      }, cap);
      return true;
    } catch {
      return false;
    }
  }, []);

  const flushSegmentRef = React.useRef<() => Promise<void>>(async () => undefined);

  const flushSegment = React.useCallback(async () => {
    if (flushingSegmentRef.current) return;
    if (!hadSpeechInSegmentRef.current && recorderRef.current) {
      // Quiet segment — don't burn a transcription call.
      return;
    }
    if (!recorderRef.current) return;
    flushingSegmentRef.current = true;
    if (segmentFlushTimerRef.current) clearTimeout(segmentFlushTimerRef.current);
    if (segmentMaxTimerRef.current) clearTimeout(segmentMaxTimerRef.current);
    segmentFlushTimerRef.current = null;
    segmentMaxTimerRef.current = null;
    try {
      const blob = await stopCurrentRecorder();
      const keepGoing = listeningRef.current && !stoppingRef.current;
      if (keepGoing) beginRecorderSegment();
      if (blob) queueSegmentTranscription(blob);
    } finally {
      flushingSegmentRef.current = false;
    }
  }, [beginRecorderSegment, queueSegmentTranscription, stopCurrentRecorder]);

  flushSegmentRef.current = flushSegment;

  const scheduleSegmentFlush = React.useCallback(() => {
    if (segmentFlushTimerRef.current) clearTimeout(segmentFlushTimerRef.current);
    segmentFlushTimerRef.current = setTimeout(() => {
      void flushSegmentRef.current();
    }, SEGMENT_FLUSH_MS);
  }, []);

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
        if (level >= SPEECH_LEVEL) {
          hadSpeechInSegmentRef.current = true;
          finishAfter(SILENCE_MS);
          scheduleSegmentFlush();
        }
      };
      sample();
      analyserTimerRef.current = setInterval(sample, LEVEL_SAMPLE_MS);
    },
    [finishAfter, scheduleSegmentFlush]
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
        listeningRef.current = false;
        clearStopTimers();
      } else if (event.error === "no-speech" || event.error === "aborted") {
        // Benign — onend will reopen if we're still listening.
      } else if (event.error === "network" || event.error === "audio-capture") {
        // Recoverable on the web path; keep transcript, let onend retry.
      } else {
        setError("Dictation stopped unexpectedly. What you already said is kept.");
      }
    };
    recognition.onend = () => {
      if (!stoppingRef.current && !micDeniedRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          listeningRef.current = false;
          clearStopTimers();
          setError("Dictation stopped unexpectedly. What you already said is kept.");
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
      listeningRef.current = true;
      if (!beginRecorderSegment()) {
        releaseStream();
        listeningRef.current = false;
        setError("Voice input isn't available in this browser. You can type instead.");
        return false;
      }
      monitorRecordingSilence(stream);
      return true;
    } catch {
      micDeniedRef.current = true;
      setMicDenied(true);
      listeningRef.current = false;
      setError("TEMPO couldn't reach your microphone. You can type instead.");
      return false;
    }
  }, [beginRecorderSegment, monitorRecordingSilence, releaseStream]);

  const start = React.useCallback(async () => {
    setError(null);
    stoppingRef.current = false;
    micDeniedRef.current = false;
    finalRef.current = "";
    segmentSeqRef.current = 0;
    applySeqRef.current = 0;
    pendingTextRef.current.clear();
    inFlightRef.current = 0;
    firstSegmentRef.current = true;
    clearStopTimers();

    const ok = mode === "live" ? startLive() : mode === "record" ? await startRecording() : false;
    if (!ok) return;
    listeningRef.current = true;
    setListening(true);
    finishAfter(INITIAL_SILENCE_MS);
    maxTimerRef.current = setTimeout(() => void finishRef.current(), MAX_DICTATION_MS);
  }, [clearStopTimers, finishAfter, mode, startLive, startRecording]);

  const finish = React.useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearStopTimers();
    listeningRef.current = false;
    setListening(false);

    if (mode === "live") {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    stopAudioMonitor();
    if (segmentFlushTimerRef.current) clearTimeout(segmentFlushTimerRef.current);
    if (segmentMaxTimerRef.current) clearTimeout(segmentMaxTimerRef.current);

    const blob = await stopCurrentRecorder();
    releaseStream();

    if (blob && blob.size >= 800) {
      setTranscribing(true);
      try {
        const file = new File([blob], "origin-dictation-final.webm", {
          type: blob.type || "audio/webm",
        });
        const text = await transcribeAssistantVoice(file);
        if (text.trim()) {
          finalRef.current = `${finalRef.current} ${text}`.trim();
          publishSpoken();
        }
      } catch (transcriptionError) {
        if (!finalRef.current.trim()) {
          setError(
            transcriptionError instanceof Error
              ? transcriptionError.message
              : "That recording couldn't be transcribed. You can type instead."
          );
        }
      } finally {
        if (inFlightRef.current === 0) setTranscribing(false);
      }
    }

    // Wait briefly for any in-flight phrase transcriptions to land.
    const started = Date.now();
    while (inFlightRef.current > 0 && Date.now() - started < 8_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    applyPendingSegments();
    setTranscribing(false);
  }, [
    applyPendingSegments,
    clearStopTimers,
    mode,
    publishSpoken,
    releaseStream,
    stopAudioMonitor,
    stopCurrentRecorder,
  ]);

  finishRef.current = finish;

  const clearError = React.useCallback(() => setError(null), []);

  React.useEffect(
    () => () => {
      stoppingRef.current = true;
      listeningRef.current = false;
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
