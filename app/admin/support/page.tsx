"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Bug, CheckCircle2, ChevronLeft, Clock3, LifeBuoy, Phone, Trash2, UserRound } from "lucide-react";
import { useCall } from "@/components/calls/call-provider";
import { MessageAttachments } from "@/components/messages/message-attachments";
import { MessageComposer } from "@/components/messages/message-composer";
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
  const call = useCall();
  const [status, setStatus] = React.useState<(typeof statuses)[number]>("open");
  const [archived, setArchived] = React.useState(false);
  const support = useAdminSupport(status, archived);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  // Below lg the queue and the open ticket can't share the screen — picking a
  // ticket explicitly opens the detail pane, with a Back button to return.
  const [viewingDetail, setViewingDetail] = React.useState(false);
  const reports = support.data?.reports ?? [];
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;

  React.useEffect(() => {
    if (selected?.id) support.update.mutate({ id: selected.id, nextStatus: selected.status, read: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when a ticket opens
  }, [selected?.id]);

  async function update(nextStatus: "open" | "in_progress" | "resolved", input: { archived?: boolean; deleteMessageId?: string } = {}) {
    if (!selected) return;
    try { await support.update.mutateAsync({ id: selected.id, nextStatus, adminNotes: notes[selected.id] ?? selected.admin_notes ?? undefined, ...input }); toast(input.archived === true ? "Ticket archived." : input.archived === false ? "Ticket restored." : input.deleteMessageId ? "Message deleted." : "Support ticket updated.", "ok"); if (input.archived !== undefined) setSelectedId(null); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t update ticket."); }
  }

  return <div className="space-y-5">
    <PageHeader title="Support inbox" subtitle="Private member conversations for bugs, questions, and product feedback." actions={<div className="flex rounded-input border border-line bg-bg-1 p-1"><button type="button" onClick={() => { setArchived(false); setSelectedId(null); setViewingDetail(false); }} className={cn("rounded-md px-3 py-1.5 text-xs", !archived ? "bg-ice text-bg-0" : "text-text-lo")}>Inbox</button><button type="button" onClick={() => { setArchived(true); setSelectedId(null); setViewingDetail(false); }} className={cn("rounded-md px-3 py-1.5 text-xs", archived ? "bg-ice text-bg-0" : "text-text-lo")}>Archived</button></div>}/>
    <div className="flex flex-wrap items-center gap-1.5">{statuses.map((value) => <button key={value || "all"} type="button" onClick={() => { setStatus(value); setSelectedId(null); setViewingDetail(false); }} className={cn("rounded-chip border px-3 py-1.5 text-xs capitalize transition-colors", status === value ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo hover:border-ice/20 hover:text-text-hi")}>{value ? value.replace("_", " ") : "All tickets"}</button>)}{reports.length ? <span className="ml-auto text-xs tabular-nums text-text-lo">{reports.length} {reports.length === 1 ? "ticket" : "tickets"}</span> : null}</div>
    {support.isLoading ? <div className="grid gap-4 lg:grid-cols-[20rem_1fr]"><div className="panel h-96 animate-pulse"/><div className="panel h-[34rem] animate-pulse"/></div> : null}
    {support.error ? <div className="panel-quiet p-4 text-sm text-warn">{support.error.message}</div> : null}
    {!support.isLoading && !support.error && reports.length === 0 ? <div className="panel-quiet flex min-h-72 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="size-8 text-ok"/><p className="mt-3 font-display text-lg text-text-hi">{archived ? "No archived tickets" : "Queue clear"}</p><p className="mt-1 text-sm text-text-lo">No support tickets match this view.</p></div> : null}
    {selected ? <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn("panel overflow-hidden", viewingDetail && "hidden lg:block")}><div className="border-b border-line px-4 py-3"><p className="label-mono">Ticket queue</p></div><div className="max-h-[42rem] overflow-y-auto">{reports.map((report) => { const Icon = report.category === "bug" ? Bug : LifeBuoy; const preview = report.messages.at(-1)?.body || (report.messages.at(-1)?.media?.length ? "Sent an attachment" : report.details); const lastMember = [...report.messages].reverse().find((message) => message.sender_role === "member")?.created_at ?? report.created_at; const unread = !report.admin_last_read_at || lastMember > report.admin_last_read_at; return <button key={report.id} type="button" onClick={() => { setSelectedId(report.id); setViewingDetail(true); }} className={cn("w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-bg-2", selected.id === report.id && "bg-ice/[0.07]")}><div className="flex items-center gap-2"><Icon className={cn("size-3.5", report.category === "bug" ? "text-warn" : "text-ice")}/><span className="label-mono truncate text-[11px]">{report.category}</span>{unread ? <span className="ml-auto size-2 rounded-full bg-amber"/> : <span className="ml-auto text-[11px] text-text-lo">{report.status.replace("_", " ")}</span>}</div><p className="mt-2 truncate text-sm font-medium text-text-hi">{report.subject}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-lo">{preview}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-text-lo"><Clock3 className="size-3"/>{date(report.last_message_at ?? report.created_at)}</p></button>; })}</div></aside>
      <section className={cn("panel flex min-h-[34rem] flex-col overflow-hidden", !viewingDetail && "hidden lg:flex")}>
        <header className="border-b border-line bg-gradient-to-r from-ice/[0.08] via-transparent to-amber/[0.04] px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><Button type="button" size="sm" variant="ghost" className="-ml-2 mt-0.5 shrink-0 lg:hidden" onClick={() => setViewingDetail(false)} aria-label="Back to queue"><ChevronLeft className="size-4"/></Button><div><div className="flex items-center gap-2"><span className="label-mono text-amber">{selected.category}</span><span className="text-xs text-text-lo">via {selected.source}</span></div><h2 className="mt-2 font-display text-xl font-semibold text-text-hi">{selected.subject}</h2><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-lo"><UserRound className="size-3.5"/>{selected.email ?? selected.user_id}<span>·</span>{date(selected.created_at)}</p></div></div><div className="flex items-center gap-2"><span className={cn("rounded-chip border px-2.5 py-1 text-xs capitalize", selected.status === "resolved" ? "border-ok/30 bg-ok/10 text-ok" : selected.status === "in_progress" ? "border-ice/30 bg-ice/10 text-ice" : "border-amber/30 bg-amber/10 text-amber")}>{selected.status.replace("_", " ")}</span><Button size="sm" variant="ghost" onClick={() => void update(selected.status, { archived: !archived })}>{archived ? <ArchiveRestore className="size-3.5"/> : <Archive className="size-3.5"/>}{archived ? "Restore" : "Archive"}</Button></div></div></header>
        <div className="flex justify-end border-b border-line px-4 py-2"><Button size="sm" variant="ghost" onClick={() => call.start({ scope: "support", id: selected.id, title: selected.subject, href: `/admin/support?report=${selected.id}` })}><Phone className="size-3.5"/>Call member</Button></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5"><div className="flex justify-start"><div className="max-w-[82%] rounded-card bg-bg-2 px-4 py-3"><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">{selected.details}</p><p className="mt-2 text-[11px] text-text-lo">Member · {date(selected.created_at)}</p></div></div>{selected.messages.map((message) => { const mine = message.sender_role === "support"; const system = message.body.startsWith("::system::"); return system ? <p key={message.id} className="text-center text-xs text-text-lo">{message.body.slice("::system::".length)}</p> : <div key={message.id} className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start")}>{mine ? <button type="button" aria-label="Delete message" onClick={() => { if (window.confirm("Delete this support reply?")) void update(selected.status, { deleteMessageId: message.id }); }} className="invisible rounded-input p-1.5 text-text-lo hover:text-warn group-hover:visible"><Trash2 className="size-3.5"/></button> : null}<div className={cn("max-w-[82%] rounded-card px-4 py-3", mine ? "border border-ice/20 bg-ice/10" : "bg-bg-2")}><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">{message.body}</p><MessageAttachments media={message.media} scope="support" threadId={selected.id}/><p className="mt-2 text-[11px] text-text-lo">{mine ? "TEMPO Support" : "Member"} · {date(message.created_at)}</p></div></div>; })}</div>
        {!archived ? <div className="border-t border-line bg-bg-1/70 p-4"><MessageComposer scope="support" threadId={selected.id} pending={support.update.isPending} placeholder="Reply to the member…" onSend={async ({ body, media }) => { await support.update.mutateAsync({ id: selected.id, nextStatus: selected.status === "open" ? "in_progress" : selected.status, adminNotes: notes[selected.id] ?? selected.admin_notes ?? undefined, reply: body, media }); toast("Reply delivered to the member’s Messages.", "ok"); }}/><div className="mt-3 flex flex-wrap items-center gap-2">{selected.status !== "resolved" ? <Button size="sm" variant="secondary" disabled={support.update.isPending} onClick={() => void update("resolved")}>Resolve</Button> : <Button size="sm" variant="secondary" disabled={support.update.isPending} onClick={() => void update("open")}>Reopen</Button>}</div><details className="mt-3"><summary className="cursor-pointer text-xs text-text-lo">Private admin notes</summary><Textarea className="mt-2" rows={2} placeholder="Only admins can see this" value={notes[selected.id] ?? selected.admin_notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [selected.id]: event.target.value }))}/><Button className="mt-2" size="sm" variant="ghost" disabled={support.update.isPending} onClick={() => void update(selected.status)}>Save notes</Button></details></div> : null}
      </section>
    </div> : null}
  </div>;
}
