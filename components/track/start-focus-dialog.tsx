"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useChecklist } from "@/hooks/use-checklist";
import { useSessionMutations } from "@/hooks/use-sessions";
import { FOCUS_CHECKLIST_KEY } from "@/lib/focus-storage";

type StartFocusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  trackTitle: string;
};

/**
 * Goal + optional checklist subset before dropping into the reduced focus
 * shell (FEATURE-SPECS §10). Reachable from the track page and Today.
 */
export function StartFocusDialog({
  open,
  onOpenChange,
  trackId,
  trackTitle,
}: StartFocusDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: items = [] } = useChecklist(open ? trackId : null);
  const { startFocus } = useSessionMutations(trackId);

  const [goal, setGoal] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setGoal("");
      setSelected(new Set());
    }
  }, [open]);

  const openItems = items.filter((i) => !i.done);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await startFocus.mutateAsync({ goal: goal || null });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          FOCUS_CHECKLIST_KEY(trackId),
          JSON.stringify(Array.from(selected))
        );
      }
      onOpenChange(false);
      router.push(`/track/${trackId}/focus`);
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Couldn’t start a focus session — try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Start a focus session"
        description={trackTitle}
        onClose={() => onOpenChange(false)}
      >
        <form className="space-y-4" onSubmit={handleStart}>
          <div>
            <Label htmlFor="focus-goal">What are you doing this session?</Label>
            <Input
              id="focus-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Comp the lead vocal…"
              autoFocus
            />
          </div>

          {openItems.length > 0 ? (
            <div>
              <Label>Bring these checklist items along (optional)</Label>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-input border border-line bg-bg-2/50 p-2">
                {openItems.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2 rounded-input px-1.5 py-1 text-sm text-text-hi hover:bg-bg-1">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--ice)]"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      {item.text}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Starting…" : "Start focus session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
