"use client";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { useAdminOverview } from "@/hooks/use-admin";
import { niceMax } from "@/components/artist/chart-kit";

function bytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`; }
export default function AdminOverviewPage() {
  const { data, isLoading, error } = useAdminOverview();
  return <div className="space-y-6"><PageHeader title="Admin overview" subtitle="Account health and program activity — never members’ private creative work." />
    {isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="panel h-28 animate-pulse" />)}</div> : null}
    {error ? <div className="panel-quiet p-4 text-sm text-warn">{error.message}</div> : null}
    {data ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="Members" value={data.totalMembers} /><StatTile label="New this week" value={data.signupsWeek} detail={`${data.signupsMonth} this month`} /><StatTile label="Active · 7 days" value={data.active7} detail={`${data.active30} in 30 days`} /><StatTile label="Moderation reports" value={data.openReports} detail="Open" /><StatTile label="Support reports" value={data.openSupportReports} detail="Open" /><StatTile label="Outstanding invites" value={data.outstandingInvites} /><StatTile label="Member storage" value={bytes(data.totalStorageBytes)} /></div>
      <section className="panel p-4"><div className="flex items-center justify-between"><p className="label-mono">Signups · 90 days</p><span className="text-xs text-text-lo">{data.signups.reduce((n, d) => n + d.count, 0)} total</span></div><div className="mt-5 flex h-28 items-end gap-px" aria-label="Daily signups for the last 90 days">{data.signups.map((day) => { const max = niceMax(Math.max(1, ...data.signups.map((d) => d.count))); return <div key={day.date} title={`${day.date}: ${day.count}`} className="min-w-0 flex-1 rounded-t-sm bg-ice/70" style={{ height: `${Math.max(3, (day.count / max) * 100)}%` }} />; })}</div></section></> : null}
  </div>;
}
