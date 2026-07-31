"use client";
import * as React from "react";
import { Copy, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { useAdminInvites } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import type { AdminInvite } from "@/lib/api/admin";

function date(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Never"; }
export default function AdminInvitesPage() {
  const invites = useAdminInvites(); const { toast } = useToast(); const [open, setOpen] = React.useState(false); const [email, setEmail] = React.useState(""); const [note, setNote] = React.useState(""); const [expiresAt, setExpiresAt] = React.useState("");
  async function create() { try { const result = await invites.create.mutateAsync({ email, note, expiresAt: expiresAt || undefined }); setOpen(false); setEmail(""); setNote(""); setExpiresAt(""); await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${result.invite.code}`); toast("Invite created and link copied.", "ok"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn’t create invite."); } }
  async function copy(row: AdminInvite) { await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${row.code}`); toast("Invite link copied.", "ok"); }
  const columns: AdminColumn<AdminInvite>[] = [
    { key: "code", label: "Code", className: "md:col-span-3 font-medium text-text-hi", render: (row) => row.code }, { key: "recipient", label: "Recipient", className: "md:col-span-3 text-text-lo", render: (row) => row.email ?? row.note ?? "Open invite" }, { key: "uses", label: "Uses", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => `${row.used_count} / ${row.max_uses}` }, { key: "expiry", label: "Expires", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => row.revoked_at ? "Revoked" : date(row.expires_at) }, { key: "actions", label: "Actions", className: "md:col-span-2 flex gap-1", render: (row) => <><Button size="icon" variant="ghost" aria-label="Copy invite" onClick={() => void copy(row)}><Copy /></Button>{!row.revoked_at ? <Button size="icon" variant="ghost" aria-label="Revoke invite" onClick={() => void invites.revoke.mutateAsync(row.id).then(() => toast("Invite revoked.", "ok")).catch((e) => toast(e.message))}><X /></Button> : null}</> },
  ];
  return <div className="space-y-5"><PageHeader title="Invites" subtitle="Issue a unique link for each person and revoke access without redeploying." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New invite</Button>} />
    {invites.isLoading ? <div className="panel h-64 animate-pulse" /> : null}{invites.error ? <div className="panel-quiet p-4 text-sm text-warn">{invites.error.message}</div> : null}{invites.data ? <AdminTable columns={columns} rows={invites.data.invites} rowKey={(row) => row.id} empty="No invites yet." /> : null}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Create invite" description="Email and expiry are optional. New invites allow one signup." onClose={() => setOpen(false)}><div className="space-y-3"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"/><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"/><Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={invites.create.isPending}>{invites.create.isPending ? "…" : "Create & copy"}</Button></div></div></DialogContent></Dialog>
  </div>;
}
