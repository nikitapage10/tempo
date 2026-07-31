"use client";
import * as React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AdminTable, StatusChip, type AdminColumn } from "@/components/admin/admin-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminReports } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import type { AdminReport } from "@/lib/api/admin";

function targetSummary(report: AdminReport) { if (!report.target) return "Content unavailable"; if (report.target_type === "profile") return String(report.target.display_name ?? "Published profile"); return String(report.target.body ?? "Published content"); }
export default function AdminReportsPage() {
  const { toast } = useToast(); const [status, setStatus] = React.useState("open"); const reports = useAdminReports(status); const [pending, setPending] = React.useState<{ report: AdminReport; action: "hide" | "dismiss" | "suspend_author" } | null>(null);
  async function act() { if (!pending) return; try { await reports.act.mutateAsync({ id: pending.report.id, action: pending.action }); toast("Report updated.", "ok"); setPending(null); } catch (e) { toast(e instanceof Error ? e.message : "Couldn’t update report."); } }
  const columns: AdminColumn<AdminReport>[] = [
    { key: "report", label: "Report", className: "md:col-span-3", render: (row) => <div><p className="font-medium text-text-hi">{row.reason}</p><p className="mt-1 text-xs text-text-lo">{row.target_type.replace("_", " ")}</p></div> },
    { key: "content", label: "Reported public content", className: "md:col-span-4", render: (row) => <p className="line-clamp-3 text-text-lo">{targetSummary(row)}</p> },
    { key: "status", label: "Status", className: "md:col-span-1", render: (row) => <StatusChip status={row.status} /> },
    { key: "actions", label: "Actions", className: "md:col-span-4 flex flex-wrap gap-1", render: (row) => row.status === "open" ? <>{row.target_type === "post" ? <Button size="sm" variant="secondary" onClick={() => setPending({ report: row, action: "hide" })}>Hide</Button> : null}<Button size="sm" variant="destructive" onClick={() => setPending({ report: row, action: "suspend_author" })}>Suspend author</Button><Button size="sm" variant="ghost" onClick={() => setPending({ report: row, action: "dismiss" })}>Dismiss</Button></> : <span className="text-xs text-text-lo">Reviewed</span> },
  ];
  return <div className="space-y-5"><PageHeader title="Reports" subtitle="Review only the specific public post, comment, or profile attached to a report." />
    <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi"><option value="open">Open</option><option value="actioned">Actioned</option><option value="dismissed">Dismissed</option><option value="">All</option></select>
    {reports.isLoading ? <div className="panel h-64 animate-pulse" /> : null}{reports.error ? <div className="panel-quiet p-4 text-sm text-warn">{reports.error.message}</div> : null}{reports.data ? <AdminTable columns={columns} rows={reports.data.reports} rowKey={(row) => row.id} empty="No reports in this queue." /> : null}
    <ConfirmDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }} title={pending?.action === "dismiss" ? "Dismiss this report?" : pending?.action === "hide" ? "Hide this post?" : "Suspend this author?"} description={pending?.action === "suspend_author" ? "Their active sessions and future sign-ins will be blocked." : "The action will be recorded in the audit log."} confirmLabel={pending?.action === "dismiss" ? "Dismiss" : pending?.action === "hide" ? "Hide post" : "Suspend author"} busy={reports.act.isPending} onConfirm={act} />
  </div>;
}
