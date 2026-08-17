"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { TaskPriority } from "@/lib/types";

const PRIORITY_LABELS: Record<TaskPriority, string> = { 0: "None", 1: "Low", 2: "High", 3: "Urgent" };

export function TaskBulkBar({
  count,
  onClear,
  onSetPriority,
  onClose,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onSetPriority: (priority: TaskPriority) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [priorityOpen, setPriorityOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (count === 0) return null;

  return (
    <div className="glass sticky bottom-4 z-20 flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-sm text-text-hi">
        <span className="font-data tabular-nums">{count}</span> selected
      </span>
      <div className="relative">
        <Button type="button" variant="secondary" size="sm" onClick={() => setPriorityOpen((v) => !v)}>
          Set priority
        </Button>
        {priorityOpen ? (
          <div className="absolute bottom-full left-0 mb-2 flex gap-1.5 rounded-input border border-line bg-bg-1 p-2 shadow-e2">
            {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
              <Chip
                key={p}
                size="sm"
                onClick={() => {
                  onSetPriority(p);
                  setPriorityOpen(false);
                }}
              >
                {PRIORITY_LABELS[p]}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onClose}>
        Close out
      </Button>
      {confirmDelete ? (
        <span className="flex items-center gap-2 text-xs">
          <span className="text-text-lo">Delete {count}?</span>
          <button type="button" className="text-warn hover:underline" onClick={onDelete}>
            Confirm
          </button>
          <button type="button" className="text-text-lo hover:underline" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
