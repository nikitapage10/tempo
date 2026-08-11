"use client";

import * as React from "react";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOriginSpeech } from "@/hooks/use-origin-speech";
import { parseScheduleWithAI } from "@/lib/api/calendar-schedule";
import { parseNaturalSchedule } from "@/lib/calendar/natural-language";
import type { ScheduleParseResult } from "@/lib/calendar/schedule-schema";
import { cn } from "@/lib/utils";

/**
 * The calendar's quick-add — type or dictate a plain sentence and it becomes
 * a scheduled event or task. Tries the assistant model first for real
 * language understanding (weekday math, implied duration, task vs. event);
 * falls back to the local regex parser instantly if the model call fails or
 * isn't configured, so this never blocks scheduling.
 */
export function CalendarAiScheduler({
  today,
  timezone,
  onSchedule,
}: {
  today: string;
  timezone: string;
  onSchedule: (parsed: ScheduleParseResult) => Promise<void>;
}) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const baseTextRef = React.useRef("");
  const valueRef = React.useRef("");
  valueRef.current = value;

  const speech = useOriginSpeech({
    onTranscript: setValue,
    baseText: () => baseTextRef.current,
  });
  const canSpeak = speech.mode !== "unavailable" && !speech.micDenied;

  async function toggleMic() {
    if (speech.listening) {
      await speech.finish();
      return;
    }
    baseTextRef.current = valueRef.current.trim();
    await speech.start();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      let parsed: ScheduleParseResult;
      try {
        parsed = await parseScheduleWithAI({ text, today, timezone });
      } catch {
        const fallback = parseNaturalSchedule(text, today);
        parsed = { title: fallback.title, date: fallback.date, time: fallback.time, kind: fallback.kind, isTask: fallback.task };
      }
      await onSchedule(parsed);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Quick schedule with AI" className="glass flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <Sparkles className="hidden size-4 shrink-0 text-violet sm:block" aria-hidden />
      <label htmlFor="calendar-ai-scheduler" className="sr-only">
        Quick schedule — type or speak
      </label>
      <input
        id="calendar-ai-scheduler"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          speech.listening
            ? "Listening…"
            : 'Try "Studio session Friday at 7pm", or "task: mix notes"'
        }
        disabled={speech.transcribing}
        className="h-10 min-w-0 flex-1 rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi placeholder:text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
      {speech.error ? <p className="text-xs text-warn sm:hidden">{speech.error}</p> : null}
      <div className="flex items-center gap-2">
        {canSpeak ? (
          <Button
            type="button"
            size="icon"
            variant={speech.listening ? "secondary" : "ghost"}
            onClick={() => void toggleMic()}
            disabled={speech.transcribing}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop dictating" : "Dictate a schedule note"}
            className={speech.listening ? "border border-ice/50 bg-ice/10 text-ice" : undefined}
          >
            <Mic className={cn("size-4", speech.listening && "animate-pulse motion-reduce:animate-none")} />
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy || speech.listening || speech.transcribing || !value.trim()}>
          <Sparkles className="size-3.5" />
          {busy ? "Scheduling…" : speech.transcribing ? "Writing down…" : "Schedule"}
        </Button>
      </div>
      {speech.error ? <p className="hidden text-xs text-warn sm:block">{speech.error}</p> : null}
    </form>
  );
}
