"use client";

import { AlertTriangle, CalendarPlus } from "lucide-react";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { formatDayHeading } from "@/lib/calendar/date";
import type { CalendarItem, CalendarMilestoneStage } from "@/lib/calendar/types";

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

export function CalendarTimeline({
  items,
  showSpace,
  displayTimezone,
  onActivate,
  onCreateMilestone,
}: {
  items: CalendarItem[];
  showSpace: boolean;
  displayTimezone?: string;
  onActivate: (item: CalendarItem) => void;
  onCreateMilestone: (stage: CalendarMilestoneStage) => void;
}) {
  const stageFor = (item: CalendarItem): CalendarMilestoneStage | null => {
    if (item.event?.milestone_stage) return item.event.milestone_stage;
    if (item.source === "pitching_deadline") return "pitching";
    if (item.source === "release_date") return "release";
    return null;
  };
  return (
    <section className="glass overflow-x-auto p-3 sm:p-4" aria-label="Creative timeline">
      <div className="grid min-w-[940px] grid-cols-6 gap-2">
        {STAGES.map((stage) => {
          const stageItems = items.filter((item) => stageFor(item) === stage.value).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <div key={stage.value} className="min-h-[360px] rounded-card border border-line bg-bg-2/25 p-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="label-mono text-text-lo">{stage.label}</h2>
                <button type="button" onClick={() => onCreateMilestone(stage.value)} aria-label={`Add ${stage.label} milestone`} className="rounded-input p-1 text-text-lo hover:bg-bg-1 hover:text-ice">
                  <CalendarPlus className="size-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {stageItems.map((item) => (
                  <div key={item.id}>
                    <p className="mb-1 font-mono text-[10px] text-text-lo">{formatDayHeading(item.date)}</p>
                    <CalendarItemSurface item={item} showSpace={showSpace} onActivate={onActivate} displayTimezone={displayTimezone} />
                  </div>
                ))}
                {!stageItems.length ? <p className="px-1 py-4 text-center text-xs text-text-lo/60">No milestones</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function WorkloadWarning({ date, count }: { date: string; count: number }) {
  if (count < 5) return null;
  return (
    <span title={`${count} scheduled items on ${date}`} className="inline-flex items-center text-warn">
      <AlertTriangle className="size-3" />
      <span className="sr-only">Heavy workload</span>
    </span>
  );
}
