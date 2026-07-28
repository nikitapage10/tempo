"use client";

import { Button } from "@/components/ui/button";
import type { ProposedAction } from "@/lib/assistant/types";

type Props = {
  action: ProposedAction;
  status: "pending" | "done" | "dismissed" | "failed";
  doneLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

export function AssistantActionCard({
  action,
  status,
  doneLabel,
  onConfirm,
  onDismiss,
  busy,
}: Props) {
  if (status === "done") {
    return (
      <p className="mt-2 text-xs text-text-lo">{doneLabel ?? "Done."}</p>
    );
  }

  if (status === "dismissed") {
    return null;
  }

  return (
    <div className="well mt-2 space-y-2 p-2.5">
      <p className="text-xs text-text-lo">{action.summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={onConfirm}
        >
          {action.label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onDismiss}
        >
          No thanks
        </Button>
      </div>
    </div>
  );
}
