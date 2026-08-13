"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import type { TrackUpdate } from "@/lib/types";

type TrackNotesProps = {
  notes: string | null;
  onPatch: (patch: TrackUpdate) => Promise<void>;
};

export function TrackNotes({ notes, onPatch }: TrackNotesProps) {
  const [value, setValue] = React.useState(notes ?? "");
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const savedRef = React.useRef(notes ?? "");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setValue(notes ?? "");
    savedRef.current = notes ?? "";
  }, [notes]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleSave(next: string) {
    setValue(next);
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist(next);
    }, 600);
  }

  async function persist(next: string) {
    const trimmed = next;
    if (trimmed === savedRef.current) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    try {
      await onPatch({ notes: trimmed || null });
      savedRef.current = trimmed;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          Notes
        </h2>
        <span className="font-mono text-xs text-text-lo/70">
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Saved"
              : ""}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => scheduleSave(e.target.value)}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          void persist(value);
        }}
        placeholder="Ideas, references, what’s left…"
        rows={5}
        className="min-h-[120px] resize-y"
      />
    </section>
  );
}
