"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuietEmpty } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import { completeReviewRequest, fetchMyWork, resolveAssignedComment, setAssignedTaskStatus } from "@/lib/api/team-operations";
import { cn, errorMessage } from "@/lib/utils";

const URGENCY_LABELS = {
  overdue: "Overdue",
  today: "Due today",
  review_requested: "Review requested",
  upcoming: "Upcoming",
  open: "Open",
} as const;

export function MyWorkPanel() {
  const [kind, setKind] = React.useState<"all" | "task" | "comment" | "review">("all");
  const qc = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ["team-operations", "my-work", kind],
    queryFn: () => fetchMyWork({ kind: kind === "all" ? null : kind }),
    staleTime: 15_000,
  });
  const complete = useMutation({
    mutationFn: async (item: { kind: "task" | "comment" | "review"; id: string }) => {
      if (item.kind === "task") await setAssignedTaskStatus(item.id, "done");
      else if (item.kind === "comment") await resolveAssignedComment(item.id);
      else await completeReviewRequest(item.id, "complete_without_response");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-operations", "my-work"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast("Handoff completed.", "ok");
    },
    onError: (error) => toast(errorMessage(error, "Couldn’t complete that handoff.")),
  });

  return (
    <section className="space-y-4" aria-labelledby="my-work-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p id="my-work-title" className="label-mono">My Work</p>
          <p className="mt-1 text-sm text-text-lo">Every task and review assigned to you, across artists.</p>
        </div>
        <div className="flex gap-1 rounded-chip border border-line p-0.5">
          {(["all", "task", "comment", "review"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setKind(value)}
              className={cn("rounded-chip px-2.5 py-1 text-xs capitalize",kind === value ? "bg-bg-2 text-ice" : "text-text-lo")}>
              {value === "all" ? "All" : `${value}s`}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? <div className="h-28 animate-pulse rounded-panel bg-bg-2/40" /> : query.isError ? (
        <div className="panel-quiet p-4 text-sm text-warn">My Work couldn’t load. Your artist workspaces are still available from Roster.</div>
      ) : (query.data ?? []).length === 0 ? (
        <QuietEmpty>Nothing is waiting on you.</QuietEmpty>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {(query.data ?? []).map((item) => (
            <li key={`${item.kind}:${item.sourceId}`} className="well flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("label-mono",item.urgency === "overdue" ? "text-warn" : "text-text-lo")}>
                    {URGENCY_LABELS[item.urgency]}
                  </span>
                  <span className="text-xs text-ice">{item.artistName}</span>
                </div>
                <p className="mt-1 truncate text-sm text-text-hi">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-text-lo">{item.context}</p>
                {item.dueAt ? <p className="mt-1 flex items-center gap-1 text-xs text-text-lo"><Clock3 className="size-3" />{new Date(item.dueAt).toLocaleString()}</p> : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="secondary"><Link href={item.href}>{item.primaryAction}</Link></Button>
                <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate({ kind: item.kind, id: item.sourceId })}>
                  <Check className="size-3.5" /> Complete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
