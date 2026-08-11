"use client";

import * as React from "react";
import { Mic2, Square } from "lucide-react";
import { audioConstraints } from "@/hooks/use-audio-inputs";
import type { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 5 * 60;

function chooseMimeType(): string | undefined {
  const choices = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return choices.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

async function waveformFor(blob: Blob): Promise<number[]> {
  try {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const bars = 48;
    const stride = Math.max(1, Math.floor(samples.length / bars));
    const peaks = Array.from({ length: bars }, (_, index) => {
      let peak = 0;
      const end = Math.min(samples.length, (index + 1) * stride);
      for (let i = index * stride; i < end; i += Math.max(1, Math.floor(stride / 64))) peak = Math.max(peak, Math.abs(samples[i]));
      return Math.round(peak * 100) / 100;
    });
    await context.close();
    return peaks;
  } catch {
    return [];
  }
}

export function VoiceNoteRecorder({ deviceId, disabled, onRecorded, onError }: {
  deviceId: string | null;
  disabled?: boolean;
  onRecorded: (file: File, metadata: Pick<MessageAttachment, "kind" | "duration_ms" | "waveform">) => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder?.state !== "inactive") recorder?.stop();
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(deviceId) });
      const mimeType = chooseMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationMs = Math.min(MAX_SECONDS * 1000, Date.now() - startedAtRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        if (!blob.size) return;
        void waveformFor(blob).then((waveform) => onRecorded(
          new File([blob], `voice-note-${Date.now()}.${blob.type.includes("mp4") ? "m4a" : "webm"}`, { type: blob.type }),
          { kind: "voice_note", duration_ms: durationMs, waveform },
        ));
      };
      recorderRef.current = recorder;
      recorder.start(500);
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) stop();
      }, 250);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      onError(name === "NotAllowedError"
        ? "Microphone access is blocked. Allow TEMPO in your system privacy settings, then try again."
        : "TEMPO couldn't open that microphone. Choose another input or use the system default.");
    }
  }

  return <button type="button" disabled={disabled} onClick={recording ? stop : () => void start()} aria-label={recording ? "Stop voice note" : "Record voice note"} title={recording ? "Stop voice note" : "Record and attach a voice note"} className={cn("flex items-center gap-1 rounded-input p-2 text-text-lo hover:text-ice disabled:opacity-40", recording && "text-warn")}>
    {recording ? <Square className="size-4 fill-current"/> : <Mic2 className="size-4"/>}
    {recording ? <span className="text-xs tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span> : null}
  </button>;
}
