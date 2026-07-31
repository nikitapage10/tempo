"use client";
import * as React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { Pagination } from "@/components/ui/pagination";
import { useAdminAudit } from "@/hooks/use-admin";
import type { AdminAuditEntry } from "@/lib/api/admin";

function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
const columns: AdminColumn<AdminAuditEntry>[] = [
  { key: "when", label: "When", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => date(row.created_at) },
  { key: "action", label: "Action", className: "md:col-span-3 font-medium text-text-hi", render: (row) => row.action.replaceAll(".", " ") },
  { key: "target", label: "Target", className: "md:col-span-3 text-text-lo", render: (row) => `${row.target_type} · ${row.target_id}` },
  { key: "admin", label: "Admin", className: "md:col-span-4 truncate text-text-lo", render: (row) => row.admin_user_id ?? "Deleted admin" },
];
export default function AdminAuditPage() { const [page, setPage] = React.useState(1); const audit = useAdminAudit(page); return <div className="space-y-5"><PageHeader title="Audit log" subtitle="A permanent record of privileged changes." />{audit.isLoading ? <div className="panel h-64 animate-pulse" /> : null}{audit.error ? <div className="panel-quiet p-4 text-sm text-warn">{audit.error.message}</div> : null}{audit.data ? <><AdminTable columns={columns} rows={audit.data.entries} rowKey={(row) => row.id} empty="No admin actions yet." /><Pagination page={audit.data.page} totalPages={audit.data.totalPages} onPageChange={setPage} /></> : null}</div>; }
