"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SessionRecap } from "@/lib/sessions/recap-schema";

const EMPTY_RECAP: SessionRecap = { summary: "", decisions: [], tasks: [], agendaDone: [] };

export function SessionRecapDialog({
  open,
  onOpenChange,
  roomId,
  instanceId,
  notesActive,
  pending,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  instanceId: string | null;
  notesActive: boolean;
  pending: boolean;
  onApply: (recap: { summary: string; decisions: string[]; tasks: SessionRecap["tasks"] }) => Promise<void>;
}) {
  const [recap, setRecap] = React.useState<SessionRecap>(EMPTY_RECAP);
  const [keepDecisions, setKeepDecisions] = React.useState<boolean[]>([]);
  const [keepTasks, setKeepTasks] = React.useState<boolean[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setRecap(EMPTY_RECAP);
    setKeepDecisions([]);
    setKeepTasks([]);
    setError(null);
    if (!notesActive || !instanceId) return;
    setLoading(true);
    void fetch(`/api/sessions/${roomId}/recap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as SessionRecap & { error?: string };
        if (!response.ok) throw new Error(body.error || "Couldn’t prepare a recap.");
        setRecap(body);
        setKeepDecisions(body.decisions.map(() => true));
        setKeepTasks(body.tasks.map(() => true));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn’t prepare a recap."))
      .finally(() => setLoading(false));
  }, [instanceId, notesActive, open, roomId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Wrap the session"
        description={notesActive ? "Here is what I heard. Keep what is right." : "Leave a short recap for next time, or end without one."}
        onClose={() => onOpenChange(false)}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
      >
        {loading ? <p className="text-sm text-text-lo">Listening back to the notes…</p> : null}
        {error ? <p className="rounded-input border border-warn/25 bg-warn/10 p-3 text-xs text-warn">{error} You can still write the recap by hand.</p> : null}
        {!loading ? (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void onApply({
                summary: recap.summary.trim(),
                decisions: recap.decisions.filter((_, index) => keepDecisions[index]),
                tasks: recap.tasks.filter((_, index) => keepTasks[index]),
              });
            }}
          >
            <div>
              <Label htmlFor="session-recap-summary">Recap</Label>
              <Textarea
                id="session-recap-summary"
                rows={3}
                value={recap.summary}
                onChange={(event) => setRecap((current) => ({ ...current, summary: event.target.value.slice(0, 600) }))}
                placeholder="Locked the second verse. Dave takes the bridge."
              />
            </div>
            {recap.decisions.length ? (
              <fieldset className="space-y-2">
                <legend className="label-mono">Decisions</legend>
                {recap.decisions.map((decision, index) => (
                  <label key={index} className="well flex items-center gap-2 p-2">
                    <input type="checkbox" checked={keepDecisions[index] ?? false} onChange={(event) => setKeepDecisions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.checked : item))} />
                    <Input value={decision} onChange={(event) => setRecap((current) => ({ ...current, decisions: current.decisions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                  </label>
                ))}
              </fieldset>
            ) : null}
            {recap.tasks.length ? (
              <fieldset className="space-y-2">
                <legend className="label-mono">Tasks</legend>
                {recap.tasks.map((task, index) => (
                  <div key={index} className="well grid gap-2 p-2 sm:grid-cols-[auto_1fr_9rem_9rem]">
                    <input aria-label={`Keep task ${index + 1}`} type="checkbox" checked={keepTasks[index] ?? false} onChange={(event) => setKeepTasks((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.checked : item))} />
                    <Input aria-label="Task title" value={task.title} onChange={(event) => setRecap((current) => ({ ...current, tasks: current.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} />
                    <Input aria-label="Assignee" placeholder="Unassigned" value={task.assigneeName ?? ""} onChange={(event) => setRecap((current) => ({ ...current, tasks: current.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, assigneeName: event.target.value || null } : item) }))} />
                    <Input aria-label="Due date" type="date" value={task.dueDate ?? ""} onChange={(event) => setRecap((current) => ({ ...current, tasks: current.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value || null } : item) }))} />
                  </div>
                ))}
              </fieldset>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => void onApply({ summary: "", decisions: [], tasks: [] })}>
                End without recap
              </Button>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Keep it going</Button>
              <Button type="submit" disabled={pending}>{pending ? "Ending…" : "Keep recap and end"}</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
