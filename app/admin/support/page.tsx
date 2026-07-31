"use client";

import * as React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdminSupport } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState("open");
  const support = useAdminSupport(status);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  async function update(id: string, nextStatus: "open" | "in_progress" | "resolved") {
    try { await support.update.mutateAsync({ id, nextStatus, adminNotes: notes[id] }); toast("Support report updated.", "ok"); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t update report."); }
  }
  return <div className="space-y-5"><PageHeader title="Support" subtitle="Bugs, help requests, and product feedback submitted intentionally by members." />
    <div className="flex gap-1.5">{["open", "in_progress", "resolved", ""].map((value) => <button key={value || "all"} type="button" onClick={() => setStatus(value)} className={cn("rounded-chip border px-3 py-1.5 text-xs capitalize", status === value ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo")}>{value ? value.replace("_", " ") : "All"}</button>)}</div>
    {support.isLoading ? <div className="panel h-64 animate-pulse" /> : null}
    {support.error ? <div className="panel-quiet p-4 text-sm text-warn">{support.error.message}</div> : null}
    <div className="space-y-3">{support.data?.reports.map((report) => <article key={report.id} className="panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="label-mono text-amber">{report.category}</span><span className="text-[11px] text-text-lo">via {report.source}</span></div><h2 className="mt-2 font-display text-lg text-text-hi">{report.subject}</h2><p className="mt-1 text-xs text-text-lo">{report.email ?? report.user_id} · {date(report.created_at)}{report.page_url ? ` · ${report.page_url}` : ""}</p></div><span className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">{report.status.replace("_", " ")}</span></div><p className="well mt-4 whitespace-pre-wrap rounded-input p-3 text-sm leading-relaxed text-text-hi">{report.details}</p><Textarea className="mt-3" rows={2} placeholder="Private admin notes" value={notes[report.id] ?? report.admin_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={support.update.isPending} onClick={() => void update(report.id, "in_progress")}>Mark in progress</Button><Button size="sm" disabled={support.update.isPending} onClick={() => void update(report.id, "resolved")}>Resolve</Button>{report.status !== "open" ? <Button size="sm" variant="ghost" disabled={support.update.isPending} onClick={() => void update(report.id, "open")}>Reopen</Button> : null}</div></article>)}</div>
    {support.data?.reports.length === 0 ? <div className="panel-quiet p-8 text-center text-sm text-text-lo">No support reports in this queue.</div> : null}
  </div>;
}
