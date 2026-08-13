"use client";

import * as React from "react";
import { LifeBuoy } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createSupportReport, type SupportCategory } from "@/lib/api/reports";
import { cn } from "@/lib/utils";

export function SupportReportDialog({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SupportCategory>("bug");
  const [subject, setSubject] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function submit() {
    setBusy(true);
    try {
      await createSupportReport({ category, subject, details, source: "manual" });
      setOpen(false); setSubject(""); setDetails("");
      toast("Report sent. Thanks for flagging it.", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t send the report.");
    } finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} title="Report a problem" aria-label="Report a problem" className={cn("flex items-center justify-center gap-2.5 rounded-input text-sm text-text-lo transition-colors hover:bg-bg-2/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice xl:justify-start", compact ? "px-2 py-2 xl:px-3" : "w-full px-2 py-2 xl:px-3")}><LifeBuoy className="size-4 shrink-0" strokeWidth={1.75} /><span className="hidden xl:inline">Report a problem</span></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Report a problem" description="Send a bug, ask for help, or share product feedback. TEMPO includes only this report and the current page—not your music or private workspace content." onClose={() => setOpen(false)}>
      <div className="space-y-3"><div className="flex gap-1.5">{(["bug", "help", "feedback"] as SupportCategory[]).map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={cn("rounded-chip border px-3 py-1.5 text-xs capitalize", category === value ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo")}>{value}</button>)}</div>
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={category === "bug" ? "What isn’t working?" : category === "help" ? "What do you need help with?" : "What should TEMPO improve?"} maxLength={160} />
        <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What happened, what did you expect, and anything that helps reproduce it" rows={6} maxLength={5000} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || subject.trim().length < 3 || details.trim().length < 3} onClick={() => void submit()}>{busy ? "…" : "Send report"}</Button></div>
      </div>
    </DialogContent></Dialog>
  </>;
}
