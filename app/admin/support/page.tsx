"use client";

import * as React from "react";
import { Bug, CheckCircle2, Clock3, LifeBuoy, MessageSquareReply, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdminSupport } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
const statuses = ["open", "in_progress", "resolved", ""] as const;

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("open");
  const support = useAdminSupport(status);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [replies, setReplies] = React.useState<Record<string, string>>({});
  const reports = support.data?.reports ?? [];
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;

  async function update(nextStatus: "open" | "in_progress" | "resolved", sendReply = false) {
    if (!selected) return;
    const reply = replies[selected.id]?.trim();
    if (sendReply && !reply) { toast("Write a reply first."); return; }
    try {
      await support.update.mutateAsync({ id: selected.id, nextStatus, adminNotes: notes[selected.id] ?? selected.admin_notes ?? undefined, reply: sendReply ? reply : undefined });
      if (sendReply) setReplies((current) => ({ ...current, [selected.id]: "" }));
      toast(sendReply ? "Reply delivered to the member’s Messages." : "Support ticket updated.", "ok");
    } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t update ticket."); }
  }

  return <div className="space-y-5">
    <PageHeader title="Support inbox" subtitle="Private member conversations for bugs, questions, and product feedback." />
    <div className="flex flex-wrap items-center gap-1.5">
      {statuses.map((value) => <button key={value || "all"} type="button" onClick={() => { setStatus(value); setSelectedId(null); }} className={cn("rounded-chip border px-3 py-1.5 text-xs capitalize transition-colors", status === value ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo hover:border-ice/20 hover:text-text-hi")}>{value ? value.replace("_", " ") : "All tickets"}</button>)}
      {reports.length ? <span className="ml-auto text-xs tabular-nums text-text-lo">{reports.length} {reports.length === 1 ? "ticket" : "tickets"}</span> : null}
    </div>
    {support.isLoading ? <div className="grid gap-4 lg:grid-cols-[20rem_1fr]"><div className="panel h-96 animate-pulse"/><div className="panel h-[34rem] animate-pulse"/></div> : null}
    {support.error ? <div className="panel-quiet p-4 text-sm text-warn">{support.error.message}</div> : null}
    {!support.isLoading && !support.error && reports.length === 0 ? <div className="panel-quiet flex min-h-72 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="size-8 text-ok"/><p className="mt-3 font-display text-lg text-text-hi">Queue clear</p><p className="mt-1 text-sm text-text-lo">No support tickets match this view.</p></div> : null}
    {selected ? <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3"><p className="label-mono">Ticket queue</p></div>
        <div className="max-h-[42rem] overflow-y-auto">{reports.map((report) => {
          const Icon = report.category === "bug" ? Bug : LifeBuoy;
          const preview = report.messages.at(-1)?.body ?? report.details;
          return <button key={report.id} type="button" onClick={() => setSelectedId(report.id)} className={cn("w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-bg-2", selected.id === report.id && "bg-ice/[0.07]")}>
            <div className="flex items-center gap-2"><Icon className={cn("size-3.5", report.category === "bug" ? "text-warn" : "text-ice")}/><span className="label-mono truncate text-[10px]">{report.category}</span><span className="ml-auto text-[10px] text-text-lo">{report.status.replace("_", " ")}</span></div>
            <p className="mt-2 truncate text-sm font-medium text-text-hi">{report.subject}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-lo">{preview}</p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-text-lo"><Clock3 className="size-3"/>{date(report.last_message_at ?? report.created_at)}</p>
          </button>;
        })}</div>
      </aside>
      <section className="panel flex min-h-[34rem] flex-col overflow-hidden">
        <header className="border-b border-line bg-gradient-to-r from-ice/[0.08] via-transparent to-amber/[0.04] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="label-mono text-amber">{selected.category}</span><span className="text-[11px] text-text-lo">via {selected.source}</span></div><h2 className="mt-2 font-display text-xl font-semibold text-text-hi">{selected.subject}</h2><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-lo"><UserRound className="size-3.5"/>{selected.email ?? selected.user_id}<span>·</span>{date(selected.created_at)}{selected.page_url ? <><span>·</span><span className="max-w-xs truncate">{selected.page_url}</span></> : null}</p></div><span className={cn("rounded-chip border px-2.5 py-1 text-xs capitalize", selected.status === "resolved" ? "border-ok/30 bg-ok/10 text-ok" : selected.status === "in_progress" ? "border-ice/30 bg-ice/10 text-ice" : "border-amber/30 bg-amber/10 text-amber")}>{selected.status.replace("_", " ")}</span></div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex justify-start"><div className="max-w-[82%] rounded-card bg-bg-2 px-4 py-3"><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">{selected.details}</p><p className="mt-2 text-[10px] text-text-lo">Member · {date(selected.created_at)}</p></div></div>
          {selected.messages.map((message) => <div key={message.id} className={cn("flex", message.sender_role === "support" ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-card px-4 py-3", message.sender_role === "support" ? "border border-ice/20 bg-ice/10" : "bg-bg-2")}><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">{message.body}</p><p className="mt-2 text-[10px] text-text-lo">{message.sender_role === "support" ? "TEMPO Support" : "Member"} · {date(message.created_at)}</p></div></div>)}
        </div>
        <div className="border-t border-line bg-bg-1/70 p-4">
          <Textarea rows={3} placeholder="Reply to the member…" value={replies[selected.id] ?? ""} onChange={(event) => setReplies((current) => ({ ...current, [selected.id]: event.target.value }))}/>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" disabled={support.update.isPending} onClick={() => void update(selected.status === "resolved" ? "resolved" : "in_progress", true)}><MessageSquareReply className="size-3.5"/>Send reply</Button>{selected.status !== "resolved" ? <Button size="sm" variant="secondary" disabled={support.update.isPending} onClick={() => void update("resolved")}>Resolve</Button> : <Button size="sm" variant="secondary" disabled={support.update.isPending} onClick={() => void update("open")}>Reopen</Button>}</div>
          <details className="mt-3"><summary className="cursor-pointer text-xs text-text-lo">Private admin notes</summary><Textarea className="mt-2" rows={2} placeholder="Only admins can see this" value={notes[selected.id] ?? selected.admin_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [selected.id]: event.target.value }))}/><Button className="mt-2" size="sm" variant="ghost" disabled={support.update.isPending} onClick={() => void update(selected.status)}>Save notes</Button></details>
        </div>
      </section>
    </div> : null}
  </div>;
}
