"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
} from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { CalendarEventEditor } from "@/components/calendar/event-editor";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { useCalendarData } from "@/hooks/use-calendar";
import {
  addDateKey,
  formatDayHeading,
  formatMonthTitle,
  monthGridDates,
  monthGridStart,
  parseDateKey,
  shiftMonth,
} from "@/lib/calendar/date";
import type {
  CalendarEvent,
  CalendarItem,
  CalendarSourceGroup,
} from "@/lib/calendar/types";
import { localDateString } from "@/lib/format";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "agenda";
type Scope = "space" | "all";

const SOURCE_FILTERS: { value: CalendarSourceGroup; label: string }[] = [
  { value: "tasks", label: "Tasks" },
  { value: "tracks", label: "Track dates" },
  { value: "projects", label: "Projects" },
  { value: "releases", label: "Releases" },
  { value: "events", label: "Events" },
];

const SOURCE_ORDER: Record<CalendarItem["source"], number> = {
  custom_event: 0,
  release_date: 1,
  pitching_deadline: 2,
  task_due: 3,
  track_next_action: 4,
  track_deadline: 5,
  project_deadline: 6,
};

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sortItems(a: CalendarItem, b: CalendarItem) {
  if (!a.allDay && b.allDay) return -1;
  if (a.allDay && !b.allDay) return 1;
  if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) {
    return a.startsAt.localeCompare(b.startsAt);
  }
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.title.localeCompare(b.title);
}

function itemIntersectsDay(item: CalendarItem, day: string) {
  return item.date <= day && (item.endDate ?? item.date) >= day;
}

function shortDateLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDateKey(today, 1)) return "Tomorrow";
  return formatDayHeading(date);
}

export default function CalendarPage() {
  return (
    <React.Suspense fallback={<div className="panel h-[560px] animate-pulse bg-bg-1" />}>
      <CalendarContent />
    </React.Suspense>
  );
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeArtistId } = useActiveArtist();
  const { spaces, activeSpaceId } = useActiveSpace();
  const today = localDateString();

  const requestedView = searchParams.get("view");
  const requestedDate = searchParams.get("date");
  const [view, setViewState] = React.useState<CalendarView>(
    requestedView === "agenda" ? "agenda" : "month"
  );
  const [selectedDate, setSelectedDateState] = React.useState(
    validDate(requestedDate) ? requestedDate : today
  );
  const [scope, setScopeState] = React.useState<Scope>(
    searchParams.get("scope") === "all" ? "all" : "space"
  );
  const [sourceFilters, setSourceFilters] = React.useState<Set<CalendarSourceGroup>>(
    () => new Set(SOURCE_FILTERS.map((filter) => filter.value))
  );
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  const [eventDate, setEventDate] = React.useState(today);

  React.useEffect(() => {
    if (requestedView || !window.matchMedia("(max-width: 767px)").matches) return;
    setViewState("agenda");
  }, [requestedView]);

  const updateUrl = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `/calendar?${query}` : "/calendar", { scroll: false });
    },
    [router, searchParams]
  );

  function setView(next: CalendarView) {
    setViewState(next);
    updateUrl({ view: next === "month" ? null : next });
  }

  function setSelectedDate(next: string) {
    setSelectedDateState(next);
    updateUrl({ date: next === today ? null : next });
  }

  function setScope(next: Scope) {
    setScopeState(next);
    updateUrl({ scope: next === "space" ? null : next });
  }

  const scopedSpaces = React.useMemo(
    () => (scope === "all" ? spaces : spaces.filter((space) => space.id === activeSpaceId)),
    [scope, spaces, activeSpaceId]
  );
  const spaceIds = React.useMemo(() => scopedSpaces.map((space) => space.id), [scopedSpaces]);
  const spaceLabels = React.useMemo(
    () => Object.fromEntries(spaces.map((space) => [space.id, space.name])),
    [spaces]
  );
  const rangeStart =
    view === "month" ? monthGridStart(selectedDate) : selectedDate;
  const rangeEndExclusive =
    view === "month" ? addDateKey(rangeStart, 42) : addDateKey(rangeStart, 90);
  const calendarQuery = useCalendarData({
    artistId: activeArtistId,
    spaceIds,
    spaceLabels,
    rangeStart,
    rangeEndExclusive,
    today,
  });
  const data = calendarQuery.data;

  React.useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId || !data) return;
    const match = data.items.find(
      (item) => item.source === "custom_event" && item.sourceId === eventId
    );
    if (match?.event) {
      setEditingEvent(match.event);
      setEventDate(match.date);
      setEditorOpen(true);
    }
  }, [searchParams, data]);

  const filteredItems = React.useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) =>
          sourceFilters.has(item.sourceGroup) &&
          (showCompleted || item.state !== "completed")
      ),
    [data?.items, sourceFilters, showCompleted]
  );

  function toggleSource(source: CalendarSourceGroup) {
    setSourceFilters((current) => {
      const next = new Set(current);
      if (next.has(source)) {
        if (next.size === 1) return current;
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  function createEvent(date = selectedDate) {
    if (data && !data.eventsAvailable) return;
    setEditingEvent(null);
    setEventDate(date);
    setEditorOpen(true);
  }

  function activateItem(item: CalendarItem) {
    if (item.event) {
      setEditingEvent(item.event);
      setEventDate(item.date);
      setEditorOpen(true);
      updateUrl({ event: item.event.id });
      return;
    }
    router.push(item.destinationHref);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingEvent(null);
    updateUrl({ event: null });
  }

  function movePeriod(delta: number) {
    setSelectedDate(
      view === "month"
        ? shiftMonth(selectedDate, delta)
        : addDateKey(selectedDate, delta * 90)
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        subtitle="Deadlines, releases, and scheduled work."
        actions={
          <>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              aria-label="Calendar scope"
              className="h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <option value="space">
                {spaces.find((space) => space.id === activeSpaceId)?.name ?? "Active space"}
              </option>
              <option value="all">All spaces</option>
            </select>
            <Button
              type="button"
              onClick={() => createEvent()}
              disabled={!spaceIds.length || data?.eventsAvailable === false}
            >
              <Plus className="size-4" />
              Event
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] text-text-lo">
            <Filter className="size-3" /> Sources
          </span>
          {SOURCE_FILTERS.map((filter) => (
            <Chip
              key={filter.value}
              size="sm"
              active={sourceFilters.has(filter.value)}
              onClick={() => toggleSource(filter.value)}
            >
              {filter.label}
            </Chip>
          ))}
          <Chip
            size="sm"
            active={showCompleted}
            onClick={() => setShowCompleted((value) => !value)}
          >
            Completed
          </Chip>
        </div>
      </PageHeader>

      {data?.eventsAvailable === false ? (
        <div className="rounded-card border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
          Existing TEMPO dates are available. Apply migration 037 to create and edit custom events.
        </div>
      ) : null}

      <div className="panel flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => movePeriod(-1)}
            aria-label={view === "month" ? "Previous month" : "Previous 90 days"}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => movePeriod(1)}
            aria-label={view === "month" ? "Next month" : "Next 90 days"}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSelectedDate(today)}
          >
            Today
          </Button>
          <h2 className="ml-2 font-display text-base font-semibold text-text-hi sm:text-lg">
            {view === "month"
              ? formatMonthTitle(selectedDate)
              : `${formatDayHeading(rangeStart)} – ${formatDayHeading(
                  addDateKey(rangeEndExclusive, -1)
                )}`}
          </h2>
        </div>
        <div className="flex rounded-input border border-line bg-bg-2 p-0.5">
          {(["month", "agenda"] as CalendarView[]).map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => setView(option)}
              className={cn(
                "rounded-[6px] px-3 py-1.5 text-xs capitalize transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                view === option ? "bg-bg-1 text-ice shadow-e1" : "text-text-lo hover:text-text-hi"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {calendarQuery.isLoading ? (
        <div className="panel h-[560px] animate-pulse bg-bg-1" />
      ) : calendarQuery.isError ? (
        <div className="panel flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
          <CalendarRange className="size-7 text-warn" />
          <p className="mt-3 text-sm text-text-hi">Calendar couldn’t load.</p>
          <p className="mt-1 text-xs text-text-lo">
            {calendarQuery.error instanceof Error
              ? calendarQuery.error.message
              : "Try again in a moment."}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => void calendarQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : view === "month" ? (
        <MonthView
          selectedDate={selectedDate}
          today={today}
          items={filteredItems}
          showSpace={scope === "all"}
          onSelectDate={setSelectedDate}
          onCreate={createEvent}
          onActivate={activateItem}
          onMore={(date) => {
            setSelectedDateState(date);
            setViewState("agenda");
            updateUrl({
              date: date === today ? null : date,
              view: "agenda",
            });
          }}
        />
      ) : (
        <AgendaView
          startDate={rangeStart}
          endDateExclusive={rangeEndExclusive}
          today={today}
          items={filteredItems}
          showSpace={scope === "all"}
          onActivate={activateItem}
          onCreate={() => createEvent()}
        />
      )}

      <CalendarEventEditor
        open={editorOpen}
        event={editingEvent}
        defaultDate={eventDate}
        defaultSpaceId={activeSpaceId ?? spaces[0]?.id ?? ""}
        spaces={spaces}
        relationOptions={data?.relationOptions ?? []}
        onClose={closeEditor}
      />
    </div>
  );
}

function MonthView({
  selectedDate,
  today,
  items,
  showSpace,
  onSelectDate,
  onCreate,
  onActivate,
  onMore,
}: {
  selectedDate: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  onSelectDate: (date: string) => void;
  onCreate: (date: string) => void;
  onActivate: (item: CalendarItem) => void;
  onMore: (date: string) => void;
}) {
  const dates = React.useMemo(() => monthGridDates(selectedDate), [selectedDate]);
  const month = parseDateKey(selectedDate).getMonth();
  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const date of dates) {
      map.set(
        date,
        items.filter((item) => itemIntersectsDay(item, date)).sort(sortItems)
      );
    }
    return map;
  }, [dates, items]);

  return (
    <section className="panel overflow-hidden" aria-label={formatMonthTitle(selectedDate)}>
      <div className="grid grid-cols-7 border-b border-line bg-bg-2/35">
        {Array.from({ length: 7 }, (_, index) => {
          const label = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index];
          return (
            <div
              key={label}
              className="px-1 py-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-text-lo sm:text-[10px]"
            >
              {label}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7" role="grid">
        {dates.map((date, index) => {
          const dateItems = byDate.get(date) ?? [];
          const day = parseDateKey(date);
          const outside = day.getMonth() !== month;
          const selected = date === selectedDate;
          const isToday = date === today;
          const visible = dateItems.slice(0, 3);
          return (
            <div
              key={date}
              role="gridcell"
              aria-selected={selected}
              className={cn(
                "group relative min-h-[94px] min-w-0 border-line p-1 sm:min-h-[124px] sm:p-1.5 lg:min-h-[142px]",
                index % 7 !== 6 && "border-r",
                index < 35 && "border-b",
                selected && "bg-bg-2/45",
                outside && "bg-bg-0/35"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onSelectDate(date)}
                  aria-label={formatDayHeading(date)}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-input font-mono text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:text-[11px]",
                    outside ? "text-text-lo/45" : "text-text-lo",
                    isToday && "text-ice",
                    selected && "bg-bg-2 text-text-hi"
                  )}
                >
                  {isToday ? (
                    <span className="absolute bottom-0.5 size-1 rounded-full bg-ice" />
                  ) : null}
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={() => onCreate(date)}
                  className="flex size-6 items-center justify-center rounded-input text-text-lo/40 opacity-0 transition-opacity duration-hover hover:bg-bg-2 hover:text-ice focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice group-hover:opacity-100"
                  aria-label={`New event on ${formatDayHeading(date)}`}
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <div className="space-y-1">
                {visible.map((item) => (
                  <CalendarItemSurface
                    key={`${date}:${item.id}`}
                    item={item}
                    compact
                    showSpace={showSpace}
                    onActivate={onActivate}
                  />
                ))}
                {dateItems.length > visible.length ? (
                  <button
                    type="button"
                    onClick={() => onMore(date)}
                    className="block w-full truncate px-1 text-left text-[10px] text-text-lo hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  >
                    +{dateItems.length - visible.length} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AgendaView({
  startDate,
  endDateExclusive,
  today,
  items,
  showSpace,
  onActivate,
  onCreate,
}: {
  startDate: string;
  endDateExclusive: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  onActivate: (item: CalendarItem) => void;
  onCreate: () => void;
}) {
  const overdue = items
    .filter((item) => item.state === "overdue")
    .sort((a, b) => a.date.localeCompare(b.date) || sortItems(a, b));
  const upcoming = items.filter(
    (item) =>
      item.state !== "overdue" && item.date >= startDate && item.date < endDateExclusive
  );
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
      <aside className="panel-quiet h-fit p-4 xl:sticky xl:top-24">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="label-mono text-warn">Overdue</h2>
          <span className="font-mono text-[11px] text-text-lo">{overdue.length}</span>
        </div>
        {overdue.length ? (
          <div className="space-y-2">
            {overdue.slice(0, 50).map((item) => (
              <CalendarItemSurface
                key={item.id}
                item={item}
                showSpace={showSpace}
                onActivate={onActivate}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-lo">Nothing overdue.</p>
        )}
      </aside>
      <section className="panel p-4 sm:p-5" aria-label="Upcoming schedule">
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-3">
                <h2
                  className={cn(
                    "label-mono",
                    date === today ? "text-ice" : "text-text-lo"
                  )}
                >
                  {shortDateLabel(date, today)}
                </h2>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {(groups.get(date) ?? []).map((item) => (
                  <CalendarItemSurface
                    key={item.id}
                    item={item}
                    showSpace={showSpace}
                    onActivate={onActivate}
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
