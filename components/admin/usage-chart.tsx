"use client";

import { niceMax } from "@/components/artist/chart-kit";

export function UsageChart({ title, detail, data, format = (value) => String(value), tone = "ice" }: { title: string; detail: string; data: { date: string; value: number }[]; format?: (value: number) => string; tone?: "ice" | "amber" | "violet" }) {
  const max = niceMax(Math.max(1, ...data.map((point) => point.value)));
  const color = tone === "amber" ? "bg-amber/75" : tone === "violet" ? "bg-violet/75" : "bg-ice/75";
  const total = data.reduce((value, point) => value + point.value, 0);
  return <section className="panel min-w-0 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="label-mono">{title}</p><p className="mt-1 text-xs text-text-lo">{detail}</p></div><span className="shrink-0 text-sm tabular-nums text-text-hi">{format(total)}</span></div>
    <div className="mt-5 flex h-32 items-end gap-px" role="img" aria-label={`${title}, daily for 90 days`}>
      {data.map((point) => <div key={point.date} className={`min-w-0 flex-1 rounded-t-sm ${color}`} style={{ height: `${Math.max(2, point.value / max * 100)}%` }} title={`${point.date}: ${format(point.value)}`} />)}
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-text-lo"><span>90 days ago</span><span>Today</span></div>
  </section>;
}
