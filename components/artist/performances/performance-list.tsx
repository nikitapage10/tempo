"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuietEmpty } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import {
  useCandidateCalendarShows,
  usePerformanceMutations,
  usePerformances,
} from "@/hooks/use-performances";
import { PerformanceDialog } from "@/components/artist/performances/performance-dialog";
import type { Performance } from "@/lib/api/performances";
import type { Space } from "@/lib/types";

const CONTEXT_LABELS: Record<string, string> = {
  show: "Show",
  festival: "Festival",
  residency: "Residency",
  livestream: "Livestream",
  radio: "Radio",
  session: "Session",
};

/**
 * The performance log — history plus an opt-in, tick-to-import list of past
 * `live_show` calendar entries. Nothing here is auto-inserted: importing a
 * calendar event into the log is always a deliberate confirmation, never a
 * background migration, because this list is what Stage Presence measures.
 */
export function PerformanceList({ artistId, spaces }: { artistId: string; spaces: Space[] }) {
  const { data: performances } = usePerformances(artistId);
  const spaceIds = React.useMemo(() => spaces.map((s) => s.id), [spaces]);
  const { data: candidates } = useCandidateCalendarShows(spaceIds);
  const { remove } = usePerformanceMutations(artistId);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Performance | null>(null);
  const [prefill, setPrefill] = React.useState<{
    title: string;
    performedOn: string;
    calendarEventId: string;
  } | null>(null);

  function openNew() {
    setEditing(null);
    setPrefill(null);
    setDialogOpen(true);
  }

  function importCandidate(c: { calendarEventId: string; title: string; date: string }) {
    setEditing(null);
    setPrefill({ title: c.title, performedOn: c.date, calendarEventId: c.calendarEventId });
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t remove that performance.");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-text-lo">
          {performances?.length ?? 0} logged
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={openNew}>
          <Plus className="size-3.5" />
          Log a performance
        </Button>
      </div>

      {!performances || performances.length === 0 ? (
        <QuietEmpty>
          Nothing logged yet. Real shows played feed Stage Presence — nothing here is
          estimated.
        </QuietEmpty>
      ) : (
        <ul className="space-y-1.5">
          {performances.slice(0, 8).map((p) => (
            <li
              key={p.id}
              className="well flex items-center gap-3 rounded-input px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-text-hi">{p.title}</p>
                <p className="text-xs text-text-lo">
                  {p.performedOn} · {CONTEXT_LABELS[p.context] ?? p.context}
                  {p.venue ? ` · ${p.venue}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(p.id)}
                className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
                aria-label={`Remove ${p.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {candidates && candidates.length > 0 ? (
        <div className="mt-4 border-t border-line/70 pt-3">
          <p className="label-mono mb-2">From your calendar — tick to import</p>
          <ul className="space-y-1.5">
            {candidates.slice(0, 6).map((c) => (
              <li key={c.calendarEventId}>
                <button
                  type="button"
                  onClick={() => importCandidate(c)}
                  className="well lift flex w-full items-center justify-between gap-2 rounded-input px-3 py-2 text-left text-xs"
                >
                  <span className="min-w-0 flex-1 truncate text-text-hi">{c.title}</span>
                  <span className="shrink-0 text-text-lo">{c.date}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PerformanceDialog
        artistId={artistId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        prefill={prefill}
      />
    </div>
  );
}
