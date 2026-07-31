"use client";

import * as React from "react";
import { AlertTriangle, CalendarPlus, Download, GripVertical, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { addDateKey, formatDayHeading } from "@/lib/calendar/date";
import type { CalendarItem, CalendarMilestoneStage, UnscheduledCalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const STAGES: { value: CalendarMilestoneStage; label: string }[] = [
  { value: "writing", label: "Writing" },
  { value: "recording", label: "Recording" },
  { value: "mixing", label: "Mixing" },
  { value: "mastering", label: "Mastering" },
  { value: "pitching", label: "Pitching" },
  { value: "release", label: "Release" },
];

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function exportCalendarCsv(items: CalendarItem[]) {
  const rows = [
    ["Date", "End date", "Time", "Title", "Type", "Space", "Related", "Status"],
    ...items.map((item) => [
      item.date,
      item.endDate ?? "",
      item.allDay ? "All day" : item.startsAt ?? "",
      item.title,
      item.source.replaceAll("_", " "),
      item.spaceLabel,
      item.relationLabel ?? "",
      item.state,
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tempo-calendar-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CalendarInsights({ items, unscheduled, today }: { items: CalendarItem[]; unscheduled: UnscheduledCalendarItem[]; today: string }) {
  const nextWeek = addDateKey(today, 8);
  const upcoming = items.filter((item) => item.date >= today && item.date < nextWeek);
  const overdue = items.filter((item) => item.state === "overdue");
  const dayLoads = new Map<string, number>();
  upcoming.forEach((item) => dayLoads.set(item.date, (dayLoads.get(item.date) ?? 0) + 1));
  const overloaded = Array.from(dayLoads).filter(([, count]) => count >= 5);
  const releaseDates = items.filter((item) => item.source === "release_date");
  const risky = releaseDates.filter((release) => {
    const pitch = items.find((item) => item.source === "pitching_deadline" && item.sourceId === release.sourceId);
    return !pitch || Math.round((new Date(`${release.date}T12:00:00`).getTime() - new Date(`${pitch.date}T12:00:00`).getTime()) / 86400000) < 14;
  });
  const participantConflicts = new Set<string>();
  const participantSlots = new Map<string, string>();
  items.forEach((item) => item.event?.participants.forEach((participant) => {
    const key = `${item.date}:${participant.toLowerCase()}`;
    if (participantSlots.has(key)) participantConflicts.add(key);
    else participantSlots.set(key, item.id);
  }));
  return (
    <section className="panel-quiet grid gap-2 p-3 sm:grid-cols-4" aria-label="Calendar insights">
      {[
        ["Next 7 days", upcoming.length, "Scheduled items"],
        ["Overdue", overdue.length, overdue.length ? "Needs attention" : "Clear"],
        ["Unscheduled", unscheduled.length, "Ready to place"],
        ["Planning signals", overloaded.length + risky.length + participantConflicts.size, overloaded.length ? `${overloaded.length} heavy day(s)` : participantConflicts.size ? `${participantConflicts.size} availability conflict(s)` : risky.length ? `${risky.length} release risk(s)` : "Schedule balanced"],
      ].map(([label, value, note]) => <div key={label} className="rounded-input border border-line bg-bg-1 px-3 py-2"><p className="label-mono text-text-lo">{label}</p><p className={cn("mt-1 font-display text-xl font-semibold", Number(value) ? "text-text-hi" : "text-ok")}>{value}</p><p className="text-[11px] text-text-lo">{note}</p></div>)}
    </section>
  );
}

export function UnscheduledPanel({ items, scheduled, today, onSchedule, onOpen }: { items: UnscheduledCalendarItem[]; scheduled: CalendarItem[]; today: string; onSchedule: (item: UnscheduledCalendarItem, date: string) => void; onOpen: (href: string) => void }) {
  const [dates, setDates] = React.useState<Record<string, string>>({});
  const suggestedDate = React.useMemo(() => {
    const loads = Array.from({ length: 14 }, (_, index) => {
      const date = addDateKey(today, index + 1);
      return { date, count: scheduled.filter((item) => item.date === date).length };
    });
    return loads.sort((a, b) => a.count - b.count || a.date.localeCompare(b.date))[0]?.date ?? addDateKey(today, 1);
  }, [scheduled, today]);
  return (
    <aside className="panel-quiet h-fit p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="label-mono text-text-lo">Unscheduled</h2><span className="font-mono text-[11px] text-text-lo">{items.length}</span></div>
      <div className="max-h-[440px] space-y-2 overflow-y-auto">
        {items.length ? items.slice(0, 50).map((item) => <div key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/tempo-unscheduled", item.id)} className="rounded-card border border-line bg-bg-1 p-2.5">
          <div className="flex items-start gap-2"><GripVertical className="mt-0.5 size-3.5 shrink-0 text-text-lo" /><button type="button" onClick={() => onOpen(item.destinationHref)} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs text-text-hi">{item.title}</span><span className="text-[10px] text-text-lo">{item.subtitle}</span></button></div>
          <div className="mt-2 flex gap-1.5"><input type="date" value={dates[item.id] ?? ""} onChange={(event) => setDates((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={`Schedule ${item.title}`} className="h-7 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-1.5 font-mono text-[10px] text-text-hi" /><Button type="button" size="sm" variant="ghost" onClick={() => setDates((current) => ({ ...current, [item.id]: suggestedDate }))}>Suggest</Button><Button type="button" size="sm" variant="secondary" disabled={!dates[item.id]} onClick={() => onSchedule(item, dates[item.id])}>Place</Button></div>
        </div>) : <p className="text-sm text-text-lo">Everything has a date.</p>}
      </div>
    </aside>
  );
}

export function CalendarTimeline({ items, showSpace, onActivate, onCreateMilestone }: { items: CalendarItem[]; showSpace: boolean; onActivate: (item: CalendarItem) => void; onCreateMilestone: (stage: CalendarMilestoneStage) => void }) {
  const stageFor = (item: CalendarItem): CalendarMilestoneStage | null => {
    if (item.event?.milestone_stage) return item.event.milestone_stage;
    if (item.source === "pitching_deadline") return "pitching";
    if (item.source === "release_date") return "release";
    return null;
  };
  return (
    <section className="panel overflow-x-auto p-3 sm:p-4" aria-label="Creative timeline">
      <div className="grid min-w-[940px] grid-cols-6 gap-2">
        {STAGES.map((stage) => {
          const stageItems = items.filter((item) => stageFor(item) === stage.value).sort((a, b) => a.date.localeCompare(b.date));
          return <div key={stage.value} className="min-h-[360px] rounded-card border border-line bg-bg-2/35 p-2">
            <div className="mb-3 flex items-center justify-between"><h2 className="label-mono text-text-lo">{stage.label}</h2><button type="button" onClick={() => onCreateMilestone(stage.value)} aria-label={`Add ${stage.label} milestone`} className="rounded-input p-1 text-text-lo hover:bg-bg-1 hover:text-ice"><CalendarPlus className="size-3.5" /></button></div>
            <div className="space-y-2">{stageItems.map((item) => <div key={item.id}><p className="mb-1 font-mono text-[9px] text-text-lo">{formatDayHeading(item.date)}</p><CalendarItemSurface item={item} showSpace={showSpace} onActivate={onActivate} /></div>)}{!stageItems.length ? <p className="px-1 py-4 text-center text-xs text-text-lo/60">No milestones</p> : null}</div>
          </div>;
        })}
      </div>
    </section>
  );
}

export function CalendarExportActions({ items }: { items: CalendarItem[] }) {
  return <span className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => exportCalendarCsv(items)}><Download className="size-3.5" /> CSV</Button><Button type="button" size="sm" variant="ghost" onClick={() => window.print()}><Printer className="size-3.5" /> PDF</Button></span>;
}

export function NaturalLanguageCreate({ onCreate }: { onCreate: (value: string) => Promise<void> }) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return <form className="panel-quiet flex flex-col gap-2 p-3 sm:flex-row sm:items-center" onSubmit={async (event) => { event.preventDefault(); if (!value.trim()) return; setBusy(true); try { await onCreate(value); setValue(""); } finally { setBusy(false); } }}><Sparkles className="size-4 shrink-0 text-violet" /><label htmlFor="calendar-natural" className="sr-only">Quick schedule</label><input id="calendar-natural" value={value} onChange={(event) => setValue(event.target.value)} placeholder='Try “Studio session Friday at 7pm”' className="h-9 min-w-0 flex-1 rounded-input border border-line bg-bg-1 px-3 text-sm text-text-hi placeholder:text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice" /><Button type="submit" size="sm" disabled={busy || !value.trim()}><Sparkles className="size-3.5" /> Schedule</Button></form>;
}

export function WorkloadWarning({ date, count }: { date: string; count: number }) {
  if (count < 5) return null;
  return <span title={`${count} scheduled items on ${date}`} className="inline-flex items-center text-warn"><AlertTriangle className="size-3" /><span className="sr-only">Heavy workload</span></span>;
}
