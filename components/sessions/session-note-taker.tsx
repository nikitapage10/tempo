"use client";

import * as React from "react";
import { useRealtimeDictation } from "@/hooks/use-realtime-dictation";

export function SessionNoteTaker({
  roomId,
  instanceId,
  speakerLabel,
  active,
  canListen,
  onQuota,
}: {
  roomId: string;
  instanceId: string;
  speakerLabel: string;
  active: boolean;
  canListen: boolean;
  onQuota: () => void;
}) {
  const pendingRef = React.useRef("");
  const transcriptRef = React.useRef("");
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlushAtRef = React.useRef(Date.now());
  const startingRef = React.useRef(false);
  const quotaRef = React.useRef(onQuota);
  quotaRef.current = onQuota;

  const flush = React.useCallback(async () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    const text = pendingRef.current.trim();
    if (!text) return;
    pendingRef.current = "";
    const now = Date.now();
    const audioSeconds = Math.max(1, (now - lastFlushAtRef.current) / 1000);
    lastFlushAtRef.current = now;
    const response = await fetch(`/api/sessions/${roomId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId, speakerLabel, body: text, audioSeconds }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { quota?: boolean };
      if (body.quota) quotaRef.current();
      else pendingRef.current = `${text} ${pendingRef.current}`.trim();
    }
  }, [instanceId, roomId, speakerLabel]);

  const dictation = useRealtimeDictation({
    onTranscript: (text) => {
      const previous = transcriptRef.current;
      const tail = text.startsWith(previous) ? text.slice(previous.length) : text;
      transcriptRef.current = text;
      if (!tail.trim()) return;
      pendingRef.current = `${pendingRef.current} ${tail}`.trim();
      if (pendingRef.current.length >= 400) void flush();
      else {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => void flush(), 4_000);
      }
    },
  });
  const { supported, listening, finalizing, error, start, finish } = dictation;

  React.useEffect(() => {
    const shouldListen = active && canListen;
    if (!shouldListen) {
      if (listening) void finish().then(flush);
      return;
    }
    if (!supported || listening || finalizing || startingRef.current) return;
    startingRef.current = true;
    transcriptRef.current = "";
    lastFlushAtRef.current = Date.now();
    void start().finally(() => {
      startingRef.current = false;
    });
  }, [active, canListen, finalizing, finish, flush, listening, start, supported]);

  React.useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    void flush();
  }, [flush]);

  if (!active || !canListen || !error) return null;
  return <p className="text-center text-xs text-warn">{error}</p>;
}
