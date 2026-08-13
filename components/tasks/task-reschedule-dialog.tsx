"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatBucketDateLabel,
  laterMinDate,
  overdueMaxDate,
  type TaskBucket,
  weekChoiceDates,
} from "@/lib/tasks/buckets";
import type { Task } from "@/lib/types";

type TaskRescheduleDialogProps = {
  task: Task | null;
  target: TaskBucket | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onPick: (dueDate: string | null) => void;
};

const COPY: Record<
  Exclude<TaskBucket, "today">,
  { title: string; description: string }
> = {
  week: {
    title: "Which day this week?",
    description: "Pick the day this should land on.",
  },
  later: {
    title: "When later?",
    description: "Pick a date from next week on, or leave it without a due date.",
  },
  overdue: {
    title: "Already past?",
    description: "Pick a date before today — or cancel and drop it on Today instead.",
  },
};

export function TaskRescheduleDialog({
  task,
  target,
  today,
  onOpenChange,
  onPick,
}: TaskRescheduleDialogProps) {
  const open = Boolean(task && target && target !== "today");
  const [laterDate, setLaterDate] = React.useState("");
  const [overdueDate, setOverdueDate] = React.useState("");

  React.useEffect(() => {
    if (!open || !target) return;
    if (target === "later") {
      setLaterDate(laterMinDate(today));
    }
    if (target === "overdue") {
      setOverdueDate(overdueMaxDate(today));
    }
  }, [open, target, today, task?.id]);

  if (!task || !target || target === "today") return null;

  const copy = COPY[target];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={copy.title}
        description={copy.description}
        onClose={() => onOpenChange(false)}
      >
        <p className="mb-3 text-sm text-text-hi">{task.title}</p>
        {target === "week" ? (
          <div className="flex flex-wrap gap-2">
            {weekChoiceDates(today).map((date) => (
              <Button
                key={date}
                type="button"
                variant="secondary"
                onClick={() => onPick(date)}
              >
                {formatBucketDateLabel(date)}
              </Button>
            ))}
          </div>
        ) : null}
        {target === "later" ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="task-later-date">Due date</Label>
              <Input
                id="task-later-date"
                type="date"
                className="mt-1"
                min={laterMinDate(today)}
                value={laterDate}
                onChange={(e) => setLaterDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!laterDate}
                onClick={() => onPick(laterDate || null)}
              >
                Set date
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onPick(null)}
              >
                No due date
              </Button>
            </div>
          </div>
        ) : null}
        {target === "overdue" ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="task-overdue-date">Due date</Label>
              <Input
                id="task-overdue-date"
                type="date"
                className="mt-1"
                max={overdueMaxDate(today)}
                value={overdueDate}
                onChange={(e) => setOverdueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onPick(overdueMaxDate(today))}
              >
                Yesterday
              </Button>
              <Button
                type="button"
                disabled={!overdueDate}
                onClick={() => onPick(overdueDate || null)}
              >
                Set date
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
