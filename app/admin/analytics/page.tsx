"use client";

import * as React from "react";
import { Bot, Clock3, HardDrive, UploadCloud, Users, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { UsageChart } from "@/components/admin/usage-chart";
import { useAdminAnalytics } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

function bytes(value: number) { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function hours(seconds: number) { return `${(seconds / 3600).toFixed(seconds >= 36000 ? 0 : 1)}h`; }
const periods = [7, 30, 90] as const;

export default function AdminAnalyticsPage() {
  const analytics = useAdminAnalytics();
  const [period, setPeriod] = React.useState<(typeof periods)[number]>(30);
  const data = analytics.data;
  const days = data?.days.slice(-period) ?? [];
  const sum = (key: "aiMessages" | "storageAddedBytes" | "uploads" | "focusSeconds") => days.reduce((total, day) => total + day[key], 0);
  return <div className="space-y-6">
    <PageHeader title="Usage analytics" subtitle="Understand how TEMPO is being used without opening anyone’s creative work." actions={<div className="flex rounded-input border border-line bg-bg-1 p-1">{periods.map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={cn("rounded-md px-3 py-1.5 text-xs transition-colors", period === value ? "bg-ice text-bg-0" : "text-text-lo hover:text-text-hi")}>{value}d</button>)}</div>}/>
    {analytics.isLoading ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-32 animate-pulse"/>)}</div><div className="grid gap-4 xl:grid-cols-2"><div className="panel h-72 animate-pulse"/><div className="panel h-72 animate-pulse"/></div></> : null}
    {analytics.error ? <div className="panel-quiet p-4 text-sm text-warn">{analytics.error.message}</div> : null}
    {data ? <>
      <section className="panel overflow-hidden"><div className="grid gap-6 bg-[radial-gradient(circle_at_10%_20%,rgba(167,139,250,.14),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(127,180,255,.12),transparent_35%)] p-6 md:grid-cols-[1fr_auto] md:p-7"><div><p className="label-mono text-violet">Last {period} days</p><h2 className="mt-3 font-display text-2xl font-semibold text-text-hi">{sum("aiMessages").toLocaleString()} AI requests and {sum("uploads").toLocaleString()} uploads</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-lo">Members added {bytes(sum("storageAddedBytes"))} of new material and completed {hours(sum("focusSeconds"))} of focused work in this window.</p></div><div className="flex items-center gap-3 md:pr-3"><span className="flex size-12 items-center justify-center rounded-full border border-violet/20 bg-violet/10"><WandSparkles className="size-5 text-violet"/></span></div></div></section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatTile label={`AI messages · ${period}d`} value={sum("aiMessages").toLocaleString()} detail={`${data.totals.aiMessages.toLocaleString()} all time`} icon={Bot} tone="violet"/><StatTile label={`Storage added · ${period}d`} value={bytes(sum("storageAddedBytes"))} detail={`${bytes(data.totals.storageBytes)} total in use`} icon={HardDrive} tone="amber"/><StatTile label={`Uploads · ${period}d`} value={sum("uploads")} detail="Bounces and track assets" icon={UploadCloud}/><StatTile label={`Focus time · ${period}d`} value={hours(sum("focusSeconds"))} detail={`${data.totals.sessions30} sessions in the last 30d`} icon={Clock3} tone="ok"/></div>
      <div className="grid gap-4 xl:grid-cols-2"><UsageChart title="AI requests" detail="Daily assistant messages" data={days.map((day) => ({ date: day.date, value: day.aiMessages }))} tone="violet"/><UsageChart title="Storage growth" detail="New bounce and asset bytes" data={days.map((day) => ({ date: day.date, value: day.storageAddedBytes }))} format={bytes} tone="amber"/><UsageChart title="Uploads" detail="Bounces and assets added each day" data={days.map((day) => ({ date: day.date, value: day.uploads }))}/><UsageChart title="Focus time" detail="Completed session time by day" data={days.map((day) => ({ date: day.date, value: day.focusSeconds }))} format={hours} tone="ok"/></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><section className="panel p-5"><p className="label-mono">Creation snapshot · 30 days</p><div className="mt-5 grid grid-cols-3 gap-3"><div className="well p-4"><p className="font-data text-2xl tabular-nums text-text-hi">{data.totals.tracks30}</p><p className="mt-2 text-xs text-text-lo">Tracks started</p></div><div className="well p-4"><p className="font-data text-2xl tabular-nums text-text-hi">{data.totals.projects30}</p><p className="mt-2 text-xs text-text-lo">Projects started</p></div><div className="well p-4"><p className="font-data text-2xl tabular-nums text-text-hi">{data.totals.aiUsers30}</p><p className="mt-2 text-xs text-text-lo">AI users</p></div></div></section><section className="panel p-5"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10"><Users className="size-4 text-ice"/></span><div><p className="text-sm text-text-hi">Privacy-safe by design</p><p className="mt-1 text-xs leading-relaxed text-text-lo">These charts count requests, sessions, uploads, and bytes. They never expose prompts, track contents, files, or private creative work.</p></div></div><div className="mt-4 rounded-input border border-line bg-bg-0/30 px-3 py-2 text-[11px] leading-relaxed text-text-lo">Provider token counts and cost are not stored yet, so AI dollar spend is intentionally not estimated.</div></section></div>
    </> : null}
  </div>;
}
