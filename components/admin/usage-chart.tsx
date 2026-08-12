"use client";

import { BarChart3 } from "lucide-react";

type Tone = "ice" | "amber" | "violet" | "ok";
const colors: Record<Tone, string> = { ice: "#7fb4ff", amber: "#ffb56b", violet: "#a78bfa", ok: "#74d6a0" };

export function UsageChart({ title, detail, data, format = (value) => String(value), tone = "ice" }: { title: string; detail: string; data: { date: string; value: number }[]; format?: (value: number) => string; tone?: Tone }) {
  const width = 640;
  const height = 190;
  const pad = 12;
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((value, point) => value + point.value, 0);
  const peak = Math.max(0, ...data.map((point) => point.value));
  const points = data.map((point, index) => ({ ...point, x: pad + index / Math.max(1, data.length - 1) * (width - pad * 2), y: height - pad - point.value / max * (height - pad * 2) }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1)!.x.toFixed(1)},${height - pad} L${points[0].x.toFixed(1)},${height - pad} Z` : "";
  const gradientId = `usage-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const color = colors[tone];
  const start = data[0]?.date;
  const end = data.at(-1)?.date;
  const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)) : "";

  return <section className="panel min-w-0 overflow-hidden p-5">
    <div className="flex items-start justify-between gap-4"><div><p className="label-mono">{title}</p><p className="mt-2 text-xs text-text-lo">{detail}</p></div><div className="text-right"><p className="font-data text-xl tabular-nums text-text-hi">{format(total)}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-text-lo">period total</p></div></div>
    <div className="relative mt-5 h-44 overflow-hidden rounded-input border border-line/70 bg-bg-0/40">
      {total === 0 ? <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center"><span className="flex size-9 items-center justify-center rounded-full border border-line bg-bg-2"><BarChart3 className="size-4 text-text-lo"/></span><p className="mt-2 text-xs text-text-hi">No activity in this period</p><p className="mt-1 text-[11px] text-text-lo">The chart will build as usage is recorded.</p></div> : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label={`${title} from ${start} to ${end}`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.34"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="rgba(255,255,255,.055)" strokeDasharray="3 6" vectorEffect="non-scaling-stroke"/>)}
        {area ? <path d={area} fill={`url(#${gradientId})`}/> : null}{line ? <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={total ? 1 : .25}/> : null}
      </svg>
    </div>
    <div className="mt-3 flex items-center justify-between text-[11px] text-text-lo"><span>{dateLabel(start)}</span><span className="tabular-nums">Peak {format(peak)}</span><span>{dateLabel(end)}</span></div>
  </section>;
}
