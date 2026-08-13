"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useTaskMutations } from "@/hooks/use-tasks";
import {
  buildReleasePlanSuggestions,
  dedupeReleasePlanSuggestions,
  dueDateFromOffset,
  type ReleasePlanSuggestion,
} from "@/lib/release-plan";
import type { ChecklistItem, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReleasePlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  spaceId: string | null;
  releaseDate: string | null;
  tracks: { id: string; title: string }[];
  checklistByTrack: Map<string, ChecklistItem[]>;
  tasks: Task[];
};

/**
 * "Create release plan" preview (FEATURE-SPECS §12 item 6) — explicit,
 * deselectable suggestions for metadata/artwork/distribution/pitching/
 * social/DJ/follow-up. Skips anything that already exists so re-running
 * never duplicates checklist items or tasks.
 */
export function ReleasePlanDialog({
  open,
  onOpenChange,
  projectId,
  spaceId,
  releaseDate,
  tracks,
  checklistByTrack,
  tasks,
}: ReleasePlanDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const { create: createTask } = useTaskMutations(spaceId);

  const suggestions = React.useMemo(() => {
    if (!open) return [];
    const all = buildReleasePlanSuggestions(tracks);
    return dedupeReleasePlanSuggestions(all, checklistByTrack, tasks);
  }, [open, tracks, checklistByTrack, tasks]);

  React.useEffect(() => {
    if (open) setSelected(new Set(suggestions.map((_, i) => i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestions.length]);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function applyChecklistSuggestion(s: Extract<ReleasePlanSuggestion, { kind: "checklist" }>) {
    const { createChecklistItem } = await import("@/lib/api/checklist");
    const existing = checklistByTrack.get(s.trackId) ?? [];
    const sort = existing.length > 0 ? Math.max(...existing.map((i) => i.sort)) + 1 : 0;
    await createChecklistItem({ track_id: s.trackId, text: s.text, sort });
  }

  async function handleApply() {
    if (selected.size === 0) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    let failed = 0;
    try {
      for (const i of Array.from(selected)) {
        const s = suggestions[i];
        try {
          if (s.kind === "checklist") {
            await applyChecklistSuggestion(s);
          } else {
            await createTask.mutateAsync({
              title: s.title,
              category: s.category,
              project_id: projectId,
              due_date: dueDateFromOffset(releaseDate, s.dueOffsetDays),
            });
          }
        } catch {
          failed += 1;
        }
      }
      toast(
        failed > 0
          ? `Added ${selected.size - failed} item(s), ${failed} failed.`
          : `Added ${selected.size} item(s) to the release plan.`,
        failed > 0 ? "error" : "ok"
      );
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title="Create release plan"
          description="Standard checklist and task starters for metadata, artwork, distribution, pitching, social, DJ promo, and follow-up. Deselect anything you don't need — nothing that already exists is duplicated."
          onClose={() => onOpenChange(false)}
          className="max-w-xl"
        >
          {suggestions.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-lo">
              Nothing new to add — your checklist and tasks already cover the standard plan.
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <label
                    className={cn(
                      "flex items-start gap-2.5 rounded-input border px-3 py-2 text-sm transition-colors duration-hover",
                      selected.has(i)
                        ? "border-ice/30 bg-ice/5"
                        : "border-line bg-bg-2/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[var(--ice)]"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-text-hi">
                        {s.kind === "checklist" ? s.text : s.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wide text-text-lo">
                        {s.kind === "checklist"
                          ? `Checklist · ${s.trackTitle}`
                          : `Task · ${s.category}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleApply()}
              disabled={busy || suggestions.length === 0}
            >
              {busy ? "Adding…" : `Add ${selected.size} item(s)`}
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
