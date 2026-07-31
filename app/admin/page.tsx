"use client";

import Link from "next/link";
import { Activity, ArrowRight, HardDrive, LifeBuoy, ShieldAlert, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { UsageChart } from "@/components/admin/usage-chart";
import { useAdminOverview } from "@/hooks/use-admin";

function bytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`; }
function Progress({ label, value, total, tone = "ice" }: { label: string; value: number; total: number; tone?: "ice" | "amber" | "ok" }) { const pct = total ? Math.min(100, value / total * 100) : 0; const color = tone === "amber" ? "bg-amber" : tone === "ok" ? "bg-ok" : "bg-ice"; return <div><div className="flex items-center justify-between text-xs"><span className="text-text-lo">{label}</span><span className="tabular-nums text-text-hi">{value.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-3"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/></div></div>; }

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useAdminOverview();
  const attention = data ? data.openReports + data.openSupportReports : 0;
  const activeRate = data?.totalMembers ? Math.round(data.active30 / data.totalMembers * 100) : 0;
  const healthy = attention === 0;
  return <div className="space-y-6">
    <PageHeader title="Admin overview" subtitle="A clear read on growth, engagement, and what needs your attention." />
    {isLoading ? <><div className="panel h-48 animate-pulse"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="panel h-32 animate-pulse"/>)}</div></> : null}
    {error ? <div className="panel-quiet p-4 text-sm text-warn">{error.message}</div> : null}
    {data ? <>
      <section className="panel overflow-hidden">
        <div className="grid gap-6 bg-[radial-gradient(circle_at_15%_20%,rgba(127,180,255,.16),transparent_36%),radial-gradient(circle_at_90%_0%,rgba(255,181,107,.10),transparent_32%)] p-6 md:grid-cols-[1.3fr_.7fr] md:p-8">
          <div><p className="label-mono text-ice">Operational pulse</p><h2 className="mt-3 max-w-xl font-display text-2xl font-semibold tracking-tight text-text-hi md:text-3xl">{healthy ? "Everything is moving cleanly." : `${attention} ${attention === 1 ? "item needs" : "items need"} a decision.`}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-lo">{data.active30} of {data.totalMembers} members were active in the last 30 days. Private creative work stays outside this view.</p><div className="mt-5 flex flex-wrap gap-2">{data.openSupportReports ? <Link href="/admin/support" className="inline-flex items-center gap-2 rounded-input bg-ice px-3 py-2 text-xs font-medium text-bg-0">Open support queue<ArrowRight className="size-3.5"/></Link> : null}{data.openReports ? <Link href="/admin/reports" className="inline-flex items-center gap-2 rounded-input border border-line bg-bg-2 px-3 py-2 text-xs text-text-hi">Review reports<ArrowRight className="size-3.5"/></Link> : null}{healthy ? <Link href="/admin/analytics" className="inline-flex items-center gap-2 rounded-input border border-line bg-bg-2 px-3 py-2 text-xs text-text-hi">Explore analytics<ArrowRight className="size-3.5"/></Link> : null}</div></div>
          <div className="flex items-center justify-center"><div className="relative flex size-36 items-center justify-center rounded-full border border-ice/15 bg-bg-0/30 shadow-[0_0_60px_-20px_rgba(127,180,255,.5)]"><div className="absolute inset-3 rounded-full border border-dashed border-line"/><div className="text-center"><p className="font-data text-4xl tabular-nums text-text-hi">{activeRate}%</p><p className="mt-1 text-[10px] uppercase tracking-[.15em] text-text-lo">30-day active</p></div></div></div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="Members" value={data.totalMembers} detail={`${data.signupsMonth} joined this month`} icon={Users}/><StatTile label="New this week" value={data.signupsWeek} detail="Fresh accounts" icon={UserPlus} tone="ok"/><StatTile label="Open support" value={data.openSupportReports} detail={data.openSupportReports ? "Awaiting a response" : "Queue is clear"} icon={LifeBuoy} tone={data.openSupportReports ? "amber" : "ok"}/><StatTile label="Storage in use" value={bytes(data.totalStorageBytes)} detail="Bounces and track assets" icon={HardDrive} tone="violet"/></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <UsageChart title="Member growth" detail="New accounts created each day" data={data.signups.slice(-30).map((day) => ({ date: day.date, value: day.count }))} tone="ice"/>
        <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="label-mono">Membership health</p><p className="mt-2 text-xs text-text-lo">Engagement and access at a glance</p></div><Activity className="size-5 text-ice"/></div><div className="mt-6 space-y-5"><Progress label="Active in 7 days" value={data.active7} total={data.totalMembers}/><Progress label="Active in 30 days" value={data.active30} total={data.totalMembers} tone="ok"/><Progress label="Outstanding invites" value={data.outstandingInvites} total={Math.max(1, data.totalMembers + data.outstandingInvites)} tone="amber"/></div><div className="mt-6 grid grid-cols-2 gap-2"><Link href="/admin/users" className="rounded-input border border-line bg-bg-0/30 p-3 transition-colors hover:border-ice/25"><Users className="size-4 text-ice"/><p className="mt-2 text-xs text-text-hi">Manage members</p></Link><Link href="/admin/invites" className="rounded-input border border-line bg-bg-0/30 p-3 transition-colors hover:border-amber/25"><UserPlus className="size-4 text-amber"/><p className="mt-2 text-xs text-text-hi">Send invites</p></Link></div></section>
      </div>
      <section className="grid gap-3 sm:grid-cols-2"><Link href="/admin/support" className="panel lift flex items-center gap-4 p-4"><span className="flex size-10 items-center justify-center rounded-full border border-amber/20 bg-amber/10"><LifeBuoy className="size-4 text-amber"/></span><div><p className="text-sm text-text-hi">{data.openSupportReports} support {data.openSupportReports === 1 ? "ticket" : "tickets"}</p><p className="mt-1 text-xs text-text-lo">Reply privately in members’ Messages</p></div><ArrowRight className="ml-auto size-4 text-text-lo"/></Link><Link href="/admin/reports" className="panel lift flex items-center gap-4 p-4"><span className="flex size-10 items-center justify-center rounded-full border border-warn/20 bg-warn/10"><ShieldAlert className="size-4 text-warn"/></span><div><p className="text-sm text-text-hi">{data.openReports} moderation {data.openReports === 1 ? "report" : "reports"}</p><p className="mt-1 text-xs text-text-lo">Specific public content only</p></div><ArrowRight className="ml-auto size-4 text-text-lo"/></Link></section>
    </> : null}
  </div>;
}
