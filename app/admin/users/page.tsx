"use client";
import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { AdminTable, StatusChip, type AdminColumn } from "@/components/admin/admin-table";
import { Pagination } from "@/components/ui/pagination";
import { useAdminUsers } from "@/hooks/use-admin";
import type { AdminMember } from "@/lib/api/admin";

function date(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Never"; }
const columns: AdminColumn<AdminMember>[] = [
  { key: "member", label: "Member", className: "md:col-span-4", render: (row) => <div><Link href={`/admin/users/${row.id}`} className="font-medium text-text-hi hover:text-ice">{row.publicProfile?.display_name ?? row.email}</Link><p className="truncate text-xs text-text-lo">{row.email}</p></div> },
  { key: "status", label: "Status", className: "md:col-span-2", render: (row) => <StatusChip status={row.status} /> },
  { key: "joined", label: "Joined", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => date(row.createdAt) },
  { key: "active", label: "Last sign-in", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => date(row.lastSignInAt) },
  { key: "counts", label: "Workspaces", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => `${row.trackCount} tracks · ${row.projectCount} projects` },
];
export default function AdminUsersPage() {
  const [input, setInput] = React.useState(""); const [q, setQ] = React.useState(""); const [page, setPage] = React.useState(1); const [status, setStatus] = React.useState("");
  React.useEffect(() => { const timer = setTimeout(() => { setQ(input); setPage(1); }, 250); return () => clearTimeout(timer); }, [input]);
  const { data, isLoading, error } = useAdminUsers({ q, status, page });
  return <div className="space-y-5"><PageHeader title="Members" subtitle="Account identity, access state, and aggregate usage only." />
    <div className="flex flex-wrap gap-2"><Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search email, name, or handle" className="max-w-md" /><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
    {isLoading ? <div className="panel h-64 animate-pulse" /> : null}{error ? <div className="panel-quiet p-4 text-sm text-warn">{error.message}</div> : null}{data ? <><AdminTable columns={columns} rows={data.users} rowKey={(row) => row.id} empty="No members match those filters." /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}
  </div>;
}
