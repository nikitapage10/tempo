"use client";

import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { UsageChart } from "@/components/admin/usage-chart";
import { useAdminAnalytics } from "@/hooks/use-admin";

function bytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function hours(seconds: number) { return `${(seconds / 3600).toFixed(seconds >= 36000 ? 0 : 1)}h`; }

export default function AdminAnalyticsPage() {
  const analytics = useAdminAnalytics();
  const data = analytics.data;
  return <div className="space-y-6"><PageHeader title="Usage analytics" subtitle="Program-wide activity and resource usage, without opening anyone’s creative work." />
    {analytics.isLoading ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="panel h-28 animate-pulse" />)}</div><div className="panel h-52 animate-pulse" /></> : null}
    {analytics.error ? <div className="panel-quiet p-4 text-sm text-warn">{analytics.error.message}</div> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="AI messages · all time" value={data.totals.aiMessages.toLocaleString()} detail={`${data.totals.aiMessages30.toLocaleString()} in 30 days`} />
        <StatTile label="AI users · 30 days" value={data.totals.aiUsers30} detail={`${data.totals.aiEscalations30} escalated requests`} />
        <StatTile label="Storage in use" value={bytes(data.totals.storageBytes)} detail={`${bytes(data.totals.storageAdded30)} added in 30 days`} />
        <StatTile label="Uploads · 30 days" value={data.totals.uploads30} detail="Bounces and track assets" />
        <StatTile label="Focus time · 30 days" value={hours(data.totals.focusSeconds30)} detail={`${data.totals.sessions30} sessions`} />
        <StatTile label="Tracks started · 30 days" value={data.totals.tracks30} />
        <StatTile label="Projects started · 30 days" value={data.totals.projects30} />
        <StatTile label="Storage per member" value={bytes(data.totals.members ? data.totals.storageBytes / data.totals.members : 0)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <UsageChart title="AI messages" detail="Daily assistant requests" data={data.days.map((day) => ({ date: day.date, value: day.aiMessages }))} />
        <UsageChart title="Storage added" detail="New bounce and asset bytes" data={data.days.map((day) => ({ date: day.date, value: day.storageAddedBytes }))} format={bytes} tone="amber" />
        <UsageChart title="Uploads" detail="Bounces and assets added each day" data={data.days.map((day) => ({ date: day.date, value: day.uploads }))} tone="violet" />
        <UsageChart title="Focus time" detail="Completed session time by day" data={data.days.map((day) => ({ date: day.date, value: day.focusSeconds }))} format={hours} />
      </div>
      <p className="panel-quiet px-4 py-3 text-xs text-text-lo">AI analytics count assistant requests and escalations. TEMPO does not currently store token counts or provider cost, so dollar spend is not estimated here.</p>
    </> : null}
  </div>;
}
