"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Copy, Mail, Plus, RotateCw, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { useAdminInvites } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import type { AdminInvite, AdminInviteRole } from "@/lib/api/admin";

const ROLE_OPTIONS: { value: AdminInviteRole; label: string; detail: string }[] = [
  { value: "artist", label: "Artist", detail: "Standard member access and artist-first onboarding" },
  { value: "team_member", label: "Team member", detail: "Team relationship recorded; standard product access" },
  { value: "administrator", label: "Admin", detail: "Artist onboarding plus access to private operations" },
];

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Never";
}

export default function AdminInvitesPage() {
  const invites = useAdminInvites();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [memberRole, setMemberRole] = React.useState<AdminInviteRole>("artist");
  const [welcomeNote, setWelcomeNote] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  async function create() {
    try {
      const result = await invites.create.mutateAsync({ email, note, memberRole, welcomeNote, expiresAt: expiresAt || undefined });
      setOpen(false); setEmail(""); setNote(""); setMemberRole("artist"); setWelcomeNote(""); setExpiresAt("");
      if (result.delivery === "sent") toast("Invitation email sent.", "ok");
      else if (result.delivery === "failed") toast(result.deliveryError ?? "Invite created, but email delivery failed.");
      else {
        await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${result.invite.code}`);
        toast("Invite created and link copied.", "ok");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t create invite.");
    }
  }

  async function copy(row: AdminInvite) {
    await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${row.code}`);
    toast("Invite link copied.", "ok");
  }

  async function send(row: AdminInvite) {
    try {
      await invites.send.mutateAsync(row.id);
      toast(row.send_count ? "Invitation email sent again." : "Invitation email sent.", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t send invitation.");
    }
  }

  const columns: AdminColumn<AdminInvite>[] = [
    { key: "code", label: "Code", className: "md:col-span-2 font-medium text-text-hi", render: (row) => row.code },
    { key: "recipient", label: "Recipient", className: "md:col-span-3 text-text-lo", render: (row) => <div><p>{row.email ?? row.note ?? "Open invite"}</p><p className="mt-0.5 text-[11px] text-ice">{ROLE_OPTIONS.find((option) => option.value === row.member_role)?.label ?? "Artist"}</p></div> },
    { key: "delivery", label: "Delivery", className: "md:col-span-2", render: (row) => <div><p className={row.last_send_error ? "text-warn" : row.last_sent_at ? "text-ok" : "text-text-lo"}>{row.last_send_error ? "Needs retry" : row.last_sent_at ? "Sent" : "Not sent"}</p>{row.last_send_error ? <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-warn/80" title={row.last_send_error}>{row.last_send_error}</p> : null}{row.last_sent_at ? <p className="text-[11px] tabular-nums text-text-lo">{date(row.last_sent_at)} · {row.send_count}×</p> : null}</div> },
    { key: "uses", label: "Uses", className: "md:col-span-1 tabular-nums text-text-lo", render: (row) => `${row.used_count} / ${row.max_uses}` },
    { key: "expiry", label: "Expires", className: "md:col-span-2 tabular-nums text-text-lo", render: (row) => row.revoked_at ? "Revoked" : date(row.expires_at) },
    { key: "actions", label: "Actions", className: "md:col-span-2 flex gap-1", render: (row) => <><Button size="icon" variant="ghost" aria-label="Copy invite" onClick={() => void copy(row)}><Copy /></Button>{row.email && !row.revoked_at && row.used_count < row.max_uses ? <Button size="icon" variant="ghost" aria-label={row.send_count ? "Send invitation again" : "Send invitation"} disabled={invites.send.isPending} onClick={() => void send(row)}>{row.send_count ? <RotateCw /> : <Mail />}</Button> : null}{!row.revoked_at ? <Button size="icon" variant="ghost" aria-label="Revoke invite" onClick={() => void invites.revoke.mutateAsync(row.id).then(() => toast("Invite revoked.", "ok")).catch((error) => toast(error.message))}><X /></Button> : null}</> },
  ];

  return <div className="space-y-5">
    <PageHeader title="Invites" subtitle="Send a designed, one-click invitation with a unique code—or create a link to share yourself." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New invite</Button>} />
    {invites.isLoading ? <div className="panel h-64 animate-pulse" /> : null}
    {invites.error ? <div className="panel-quiet p-4 text-sm text-warn">{invites.error.message}</div> : null}
    {invites.data ? <div className="flex items-start gap-3 rounded-card border border-line bg-bg-1 px-4 py-3">{invites.data.deliveryConfig.configured ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok"/> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn"/>}<div><p className="text-sm text-text-hi">{invites.data.deliveryConfig.configured ? "Email delivery is configured" : "Email delivery needs configuration"}</p><p className="mt-0.5 text-xs leading-relaxed text-text-lo">{invites.data.deliveryConfig.configured ? <>Sending from <span className="text-text-hi">{invites.data.deliveryConfig.from}</span>. Resend must show <span className="text-text-hi">{invites.data.deliveryConfig.domain}</span> as verified.</> : <>Add both <span className="text-text-hi">RESEND_API_KEY</span> and <span className="text-text-hi">INVITE_FROM_EMAIL</span> to the production environment, then redeploy.</>}</p></div></div> : null}
    {invites.data ? <AdminTable columns={columns} rows={invites.data.invites} rowKey={(row) => row.id} empty="No invites yet." /> : null}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Create invitation" description="Add an email to send TEMPO’s invitation automatically. Leave it blank to create a copyable link." onClose={() => setOpen(false)}><div className="space-y-3">
      <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Recipient email" />
      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as AdminInviteRole)} className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi">
        {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}: {option.detail}</option>)}
      </select>
      <Textarea value={welcomeNote} onChange={(event) => setWelcomeNote(event.target.value)} rows={4} placeholder="Personal welcome note from Nikita (optional)" />
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Private admin note (optional)" />
      <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      {email ? <div className="well rounded-input p-4"><p className="label-mono text-amber">Email preview</p><p className="mt-3 font-display text-lg text-text-hi">Bring your music into focus.</p><p className="mt-1 text-xs leading-relaxed text-text-lo">The invitation identifies them as a <span className="text-text-hi">{ROLE_OPTIONS.find((option) => option.value === memberRole)?.label.toLowerCase()}</span>, explains Origin, the tour, starter checklist, and direct access to Nikita, then includes their code and one-click account button.</p>{welcomeNote.trim() ? <div className="mt-3 border-l-2 border-ice pl-3 text-xs leading-relaxed text-text-hi">{welcomeNote}</div> : null}</div> : null}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void create()} disabled={invites.create.isPending}>{invites.create.isPending ? "…" : email ? "Create & send" : "Create & copy"}</Button></div>
    </div></DialogContent></Dialog>
  </div>;
}
