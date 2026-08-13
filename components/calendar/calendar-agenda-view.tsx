"use client";

import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { shortDateLabel, sortItems } from "@/lib/calendar/items";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

export function CalendarAgendaView({
  startDate,
  endDateExclusive,
  today,
  items,
  showSpace,
  displayTimezone,
  onActivate,
  onCreate,
  onReschedule,
  selectedIds,
  onSelect,
}: {
  startDate: string;
  endDateExclusive: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  displayTimezone: string;
  onActivate: (item: CalendarItem) => void;
  onCreate: () => void;
  onReschedule: (item: CalendarItem, date: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
}) {
  const overdue = items.filter((item) => item.state === "overdue").sort((a, b) => a.date.localeCompare(b.date) || sortItems(a, b));
  const upcoming = items.filter((item) => item.state !== "overdue" && item.date >= startDate && item.date < endDateExclusive);
  const groups = new Map<string, CalendarItem[]>();
  for (const item of upcoming) {
    const group = groups.get(item.date) ?? [];
    group.push(item);
    groups.set(item.date, group);
  }
  groups.forEach((group) => group.sort(sortItems));
  const dates = Array.from(groups.keys()).sort();

  if (overdue.length === 0 && dates.length === 0) {
    return (
      <EmptyShaderPanel
        title="Nothing scheduled here yet"
        copy="TEMPO deadlines will appear automatically, or you can add a studio session, meeting, show, or other event."
        action={<Button onClick={onCreate}>Create an event</Button>}
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.34fr)_minmax(0,1fr)]">
      <aside className="glass-quiet h-fit p-4 xl:sticky xl:top-24">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="label-mono text-warn">Overdue</h2>
          <span className="font-mono text-xs text-text-lo">{overdue.length}</span>
        </div>
        {overdue.length ? (
          <div className="space-y-2">
            {overdue.slice(0, 50).map((item) => (
              <CalendarItemSurface
                key={item.id}
                item={item}
                showSpace={showSpace}
                onActivate={onActivate}
                onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                selected={selectedIds.has(item.id)}
                onSelect={onSelect}
                displayTimezone={displayTimezone}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-lo">Nothing overdue.</p>
        )}
      </aside>
      <section className="glass p-4 sm:p-5" aria-label="Upcoming schedule">
        <div className="space-y-6">
          {dates.map((date) => (
            <div
              key={date}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("text/tempo-calendar")) event.preventDefault();
              }}
              onDrop={(event) => {
                const item = items.find((candidate) => candidate.id === event.dataTransfer.getData("text/tempo-calendar"));
                if (item) onReschedule(item, date);
              }}
            >
              <div className="mb-2 flex items-center gap-3">
                <h2 className={cn("font-data text-xs font-semibold uppercase tracking-[0.12em]", date === today ? "text-ice" : "text-text-lo")}>{shortDateLabel(date, today)}</h2>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {(groups.get(date) ?? []).map((item) => (
                  <CalendarItemSurface
                    key={item.id}
                    item={item}
                    showSpace={showSpace}
                    onActivate={onActivate}
                    onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                    selected={selectedIds.has(item.id)}
                    onSelect={onSelect}
                    displayTimezone={displayTimezone}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
