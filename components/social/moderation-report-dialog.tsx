"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createModerationReport, type ModerationReason } from "@/lib/api/reports";
import { cn } from "@/lib/utils";

const choices: { value: ModerationReason; label: string }[] = [
  { value: "spam", label: "Spam" }, { value: "harassment", label: "Harassment" }, { value: "hate", label: "Hate or abuse" }, { value: "impersonation", label: "Impersonation" }, { value: "inappropriate", label: "Inappropriate content" }, { value: "other", label: "Something else" },
];

export function ModerationReportDialog({ reporterProfileId, targetType, targetId, compact = false }: { reporterProfileId: string; targetType: "post" | "profile"; targetId: string; compact?: boolean }) {
  const { toast } = useToast(); const [open, setOpen] = React.useState(false); const [reason, setReason] = React.useState<ModerationReason>("spam"); const [details, setDetails] = React.useState(""); const [busy, setBusy] = React.useState(false);
  async function submit() { setBusy(true); try { await createModerationReport({ reporterProfileId, targetType, targetId, reason, details }); setOpen(false); setDetails(""); toast("Report sent for review.", "ok"); } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t send report."); } finally { setBusy(false); } }
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={compact ? `Report this ${targetType}` : undefined} className={cn("flex items-center gap-1.5 rounded-input text-xs text-text-lo transition-colors hover:text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice", compact ? "p-1.5" : "border border-line px-3 py-2")}><Flag className="size-3.5" />{compact ? null : `Report ${targetType === "profile" ? "user" : "post"}`}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title={`Report this ${targetType === "profile" ? "user" : "post"}?`} description="The TEMPO operator will see this report and the specific public content attached to it. Your private workspace is never included." onClose={() => setOpen(false)}><div className="space-y-3"><div className="grid grid-cols-2 gap-1.5">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => setReason(choice.value)} className={cn("rounded-input border px-3 py-2 text-left text-xs", reason === choice.value ? "border-ice/40 bg-ice/10 text-ice" : "border-line text-text-lo")}>{choice.label}</button>)}</div><Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Optional details" rows={4} maxLength={2000} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void submit()}>{busy ? "…" : "Send report"}</Button></div></div></DialogContent></Dialog>
  </>;
}
