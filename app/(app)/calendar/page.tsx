"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderPlus,
  Palette,
  Plus,
  Search,
  WandSparkles,
} from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { CalendarEventEditor } from "@/components/calendar/event-editor";
import { CalendarCategoryManager } from "@/components/calendar/calendar-category-manager";
import { CalendarCategoryProvider } from "@/components/calendar/calendar-category-provider";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import {
  CalendarExportActions,
  CalendarInsights,
  CalendarTimeline,
  NaturalLanguageCreate,
  UnscheduledPanel,
  WorkloadWarning,
} from "@/components/calendar/calendar-planning-panels";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { useCalendarCategories, useCalendarData, useCalendarEventMutations } from "@/hooks/use-calendar";
import { useTaskMutations } from "@/hooks/use-tasks";
import {
  addDateKey,
  formatDayHeading,
  formatMonthTitle,
  monthGridDates,
  monthGridStart,
  parseDateKey,
  shiftMonth,
  browserTimezone,
  zonedLocalToUtc,
} from "@/lib/calendar/date";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarItem,
  CalendarMilestoneStage,
  CalendarSourceGroup,
  UnscheduledCalendarItem,
} from "@/lib/calendar/types";
import { localDateString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deliverCalendarReminders } from "@/lib/api/calendar-events";
import { DEFAULT_CALENDAR_CATEGORIES } from "@/lib/calendar/categories";

type CalendarView = "month" | "agenda" | "timeline";
type Scope = "space" | "all";

type CalendarPreset = {
  name: string;
  view: CalendarView;
  scope: Scope;
  sources: CalendarSourceGroup[];
  showCompleted: boolean;
};

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

function parseNaturalSchedule(value: string, today: string) {
  const lower = value.toLowerCase();
  let date = today;
  if (lower.includes("tomorrow")) date = addDateKey(today, 1);
  else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const match = weekdays.findIndex((day) => lower.includes(day));
    if (match >= 0) {
      const current = parseDateKey(today).getDay();
      date = addDateKey(today, ((match - current + 7) % 7) || 7);
    }
  }
  const timeMatch = lower.match(/(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  let time: string | null = null;
  if (timeMatch) {
    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3] === "pm") hour += 12;
    time = `${String(hour).padStart(2, "0")}:${timeMatch[2] ?? "00"}`;
  }
  const kind = lower.includes("studio")
    ? "studio_session"
    : lower.includes("meeting")
      ? "meeting"
      : lower.includes("content")
        ? "content"
        : lower.includes("show") || lower.includes("live")
          ? "live_show"
          : lower.includes("milestone")
            ? "milestone"
            : "other";
  const title = value
    .replace(/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(/(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi, "")
    .replace(/^\s*(event|task)\s*:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { date, time, kind, title: title || "Scheduled work", task: /^\s*task\s*:/i.test(value) } as const;
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
    requestedView === "agenda" || requestedView === "timeline" ? requestedView : "month"
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
  const [eventKind, setEventKind] = React.useState<CalendarEvent["kind"]>("other");
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventStage, setEventStage] = React.useState<CalendarMilestoneStage | null>(null);
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = React.useState("");
  const [presets, setPresets] = React.useState<CalendarPreset[]>([]);
  const [showWeekNumbers, setShowWeekNumbers] = React.useState(false);
  const [weekStartsMonday, setWeekStartsMonday] = React.useState(true);
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const calendarMutations = useCalendarEventMutations();
  const categoriesQuery = useCalendarCategories();
  const taskMutations = useTaskMutations(activeSpaceId);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("tempo-calendar-presets");
      if (saved) setPresets(JSON.parse(saved) as CalendarPreset[]);
      setShowWeekNumbers(window.localStorage.getItem("tempo-calendar-week-numbers") === "true");
      setWeekStartsMonday(window.localStorage.getItem("tempo-calendar-week-start") !== "sunday");
    } catch { /* local preferences are best-effort */ }
  }, []);

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
    if (!data?.eventsAvailable) return;
    void deliverCalendarReminders().catch(() => undefined);
  }, [data?.eventsAvailable]);

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
          (showCompleted || item.state !== "completed") &&
          (!search.trim() || `${item.title} ${item.subtitle ?? ""} ${item.relationLabel ?? ""} ${item.spaceLabel}`.toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [data?.items, sourceFilters, showCompleted, search]
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
    setEventKind("other");
    setEventTitle("");
    setEventStage(null);
    setEditorOpen(true);
  }

  function createMilestone(stage: CalendarMilestoneStage, date = selectedDate) {
    setEditingEvent(null);
    setEventDate(date);
    setEventKind("milestone");
    setEventTitle(`${stage[0].toUpperCase()}${stage.slice(1)} milestone`);
    setEventStage(stage);
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

  async function reschedule(item: CalendarItem, date: string) {
    const hasDependents = !!item.event && (data?.items ?? []).some((candidate) => candidate.event?.dependency_event_id === item.event?.id);
    const cascadeDependencies = hasDependents && window.confirm("Move dependent milestones by the same amount?");
    await calendarMutations.reschedule.mutateAsync({ item, date, cascadeDependencies });
  }

  async function scheduleUnscheduled(item: UnscheduledCalendarItem, date: string) {
    await calendarMutations.schedule.mutateAsync({ item, date });
  }

  async function naturalCreate(value: string) {
    const parsed = parseNaturalSchedule(value, today);
    if (parsed.task) {
      await taskMutations.create.mutateAsync({ title: parsed.title, due_date: parsed.date, space_id: activeSpaceId });
      return;
    }
    const zone = browserTimezone();
    const base: CalendarEventInput = {
      space_id: activeSpaceId ?? spaces[0]?.id ?? "",
      track_id: null,
      project_id: null,
      title: parsed.title,
      kind: parsed.kind,
      description: null,
      location: null,
      all_day: !parsed.time,
      start_date: parsed.time ? null : parsed.date,
      end_date: null,
      starts_at: parsed.time ? zonedLocalToUtc(parsed.date, parsed.time, zone) : null,
      ends_at: null,
      timezone: parsed.time ? zone : null,
      recurrence: "none",
      recurrence_until: null,
      reminder_minutes: [],
      participants: [],
      links: [],
      attachment_urls: [],
      milestone_stage: parsed.kind === "milestone" ? "writing" : null,
      dependency_event_id: null,
      completed_at: null,
    };
    await calendarMutations.create.mutateAsync(base);
  }

  async function applyBulkDate() {
    const selected = filteredItems.filter((item) => selectedIds.has(item.id));
    for (const item of selected) await reschedule(item, bulkDate);
    setSelectedIds(new Set());
    setBulkDate("");
  }

  function savePreset() {
    const next: CalendarPreset = { name: `Preset ${presets.length + 1}`, view, scope, sources: Array.from(sourceFilters), showCompleted };
    const updated = [...presets, next];
    setPresets(updated);
    window.localStorage.setItem("tempo-calendar-presets", JSON.stringify(updated));
  }

  function applyPreset(preset: CalendarPreset) {
    setView(preset.view);
    setScope(preset.scope);
    setSourceFilters(new Set(preset.sources));
    setShowCompleted(preset.showCompleted);
  }

  async function generateReleasePlan() {
    const release = filteredItems.find((item) => item.source === "release_date");
    if (!release) return;
    const stages: { stage: CalendarMilestoneStage; title: string; offset: number }[] = [
      { stage: "writing", title: "Songs and direction locked", offset: -84 },
      { stage: "recording", title: "Recording complete", offset: -63 },
      { stage: "mixing", title: "Mix approved", offset: -49 },
      { stage: "mastering", title: "Master delivered", offset: -42 },
      { stage: "pitching", title: "Pitching campaign begins", offset: -28 },
      { stage: "release", title: "Release day", offset: 0 },
    ];
    if (!window.confirm(`Create ${stages.length} editable milestones for ${release.title}?`)) return;
    for (const step of stages) {
      await calendarMutations.create.mutateAsync({
        space_id: release.spaceId, track_id: null, project_id: release.sourceId,
        title: step.title, kind: "milestone", description: `Generated from ${release.title}.`, location: null,
        all_day: true, start_date: addDateKey(release.date, step.offset), end_date: null, starts_at: null, ends_at: null, timezone: null,
        recurrence: "none", recurrence_until: null, reminder_minutes: step.offset === 0 ? [1440] : [], participants: [], links: [], attachment_urls: [], milestone_stage: step.stage, dependency_event_id: null, completed_at: null,
      });
    }
  }

  function movePeriod(delta: number) {
    setSelectedDate(
      view === "month"
        ? shiftMonth(selectedDate, delta)
        : addDateKey(selectedDate, delta * 90)
    );
  }

  return (
    <CalendarCategoryProvider categories={categoriesQuery.data?.categories ?? DEFAULT_CALENDAR_CATEGORIES}>
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
            <Button type="button" variant="secondary" onClick={() => createMilestone("writing")} disabled={!spaceIds.length || data?.eventsAvailable === false}><FolderPlus className="size-4" />Milestone</Button>
            <Button type="button" variant="secondary" onClick={() => void generateReleasePlan()} disabled={!filteredItems.some((item) => item.source === "release_date") || data?.eventsAvailable === false}>
              <WandSparkles className="size-4" /> Release plan
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCategoryManagerOpen(true)}>
              <Palette className="size-4" /> Categories
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
          <span className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[280px]"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-text-lo" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search schedule" className="h-9 w-full rounded-input border border-line bg-bg-2 pl-8 pr-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice" /></span>
          <Button type="button" size="sm" variant="ghost" onClick={savePreset}>Save preset</Button>
          {presets.length ? <select aria-label="Saved Calendar presets" defaultValue="" onChange={(event) => { const preset = presets[Number(event.target.value)]; if (preset) applyPreset(preset); event.target.value = ""; }} className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"><option value="">Presets…</option>{presets.map((preset, index) => <option key={`${preset.name}:${index}`} value={index}>{preset.name}</option>)}</select> : null}
          <label className="flex items-center gap-1.5 text-xs text-text-lo"><input type="checkbox" checked={showWeekNumbers} onChange={(event) => { setShowWeekNumbers(event.target.checked); window.localStorage.setItem("tempo-calendar-week-numbers", String(event.target.checked)); }} className="accent-[var(--ice)]" />Week numbers</label>
          <select value={weekStartsMonday ? "monday" : "sunday"} onChange={(event) => { const monday = event.target.value === "monday"; setWeekStartsMonday(monday); window.localStorage.setItem("tempo-calendar-week-start", monday ? "monday" : "sunday"); }} aria-label="First day of week" className="h-8 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"><option value="monday">Week starts Monday</option><option value="sunday">Week starts Sunday</option></select>
          <CalendarExportActions items={filteredItems} />
        </div>
      </PageHeader>

      <NaturalLanguageCreate onCreate={naturalCreate} />
      <CalendarInsights items={filteredItems} unscheduled={data?.unscheduled ?? []} today={today} />

      {selectedIds.size ? <div className="panel flex flex-wrap items-center gap-2 border-ice/30 px-3 py-2"><span className="text-sm text-text-hi">{selectedIds.size} selected</span><input type="date" value={bulkDate} onChange={(event) => setBulkDate(event.target.value)} className="h-8 rounded-input border border-line bg-bg-2 px-2 font-mono text-xs text-text-hi" /><Button type="button" size="sm" disabled={!bulkDate || calendarMutations.reschedule.isPending} onClick={() => void applyBulkDate()}>Move selected</Button><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button></div> : null}

      {data?.eventsAvailable === false ? (
        <div className="rounded-card border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
          Existing TEMPO dates are available. Apply migration 037 to create and edit custom events.
        </div>
      ) : null}
      {data?.eventsAvailable && data.planningAvailable === false ? (
        <div className="rounded-card border border-violet/30 bg-violet/10 px-4 py-3 text-sm text-violet">
          Apply migration 038 to persist milestones, recurrence, reminders, participants, dependencies, comments, and activity. Core events continue to work.
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
          {(["month", "agenda", "timeline"] as CalendarView[]).map((option) => (
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
      ) : view === "timeline" ? (
        <CalendarTimeline items={filteredItems} showSpace={scope === "all"} onActivate={activateItem} onCreateMilestone={createMilestone} />
      ) : view === "month" ? (
        <MonthView
          selectedDate={selectedDate}
          today={today}
          items={filteredItems}
          showSpace={scope === "all"}
          onSelectDate={setSelectedDate}
          onCreate={createEvent}
          onActivate={activateItem}
          onReschedule={(item, date) => void reschedule(item, date)}
          selectedIds={selectedIds}
          onSelect={(item, selected) => setSelectedIds((current) => { const next = new Set(current); if (selected) next.add(item.id); else next.delete(item.id); return next; })}
          showWeekNumbers={showWeekNumbers}
          weekStartsMonday={weekStartsMonday}
          unscheduled={data?.unscheduled ?? []}
          onSchedule={(item, date) => void scheduleUnscheduled(item, date)}
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
          onReschedule={(item, date) => void reschedule(item, date)}
          selectedIds={selectedIds}
          onSelect={(item, selected) => setSelectedIds((current) => { const next = new Set(current); if (selected) next.add(item.id); else next.delete(item.id); return next; })}
        />
      )}

      {!calendarQuery.isLoading && data ? <UnscheduledPanel items={data.unscheduled} scheduled={filteredItems} today={today} onSchedule={(item, date) => void scheduleUnscheduled(item, date)} onOpen={(href) => router.push(href)} /> : null}

      <CalendarEventEditor
        open={editorOpen}
        event={editingEvent}
        defaultDate={eventDate}
        defaultSpaceId={activeSpaceId ?? spaces[0]?.id ?? ""}
        spaces={spaces}
        relationOptions={data?.relationOptions ?? []}
        existingEvents={Array.from(new Map((data?.items ?? []).flatMap((item) => item.event ? [[item.event.id, item.event] as const] : [])).values())}
        defaultKind={eventKind}
        defaultTitle={eventTitle}
        defaultMilestoneStage={eventStage}
        onClose={closeEditor}
      />
      <CalendarCategoryManager open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />
    </div>
    </CalendarCategoryProvider>
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
  onReschedule,
  selectedIds,
  onSelect,
  showWeekNumbers,
  weekStartsMonday,
  unscheduled,
  onSchedule,
}: {
  selectedDate: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  onSelectDate: (date: string) => void;
  onCreate: (date: string) => void;
  onActivate: (item: CalendarItem) => void;
  onMore: (date: string) => void;
  onReschedule: (item: CalendarItem, date: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
  showWeekNumbers: boolean;
  weekStartsMonday: boolean;
  unscheduled: UnscheduledCalendarItem[];
  onSchedule: (item: UnscheduledCalendarItem, date: string) => void;
}) {
  const dates = React.useMemo(() => {
    if (weekStartsMonday) return monthGridDates(selectedDate);
    const start = addDateKey(monthGridStart(selectedDate), -1);
    return Array.from({ length: 42 }, (_, index) => addDateKey(start, index));
  }, [selectedDate, weekStartsMonday]);
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
          const labels = weekStartsMonday ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const label = labels[index];
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
              onDragOver={(event) => { if (event.dataTransfer.types.includes("text/tempo-calendar") || event.dataTransfer.types.includes("text/tempo-unscheduled")) event.preventDefault(); }}
              onDrop={(event) => {
                const itemId = event.dataTransfer.getData("text/tempo-calendar");
                const unscheduledId = event.dataTransfer.getData("text/tempo-unscheduled");
                const item = items.find((candidate) => candidate.id === itemId);
                const pending = unscheduled.find((candidate) => candidate.id === unscheduledId);
                if (item) onReschedule(item, date);
                if (pending) onSchedule(pending, date);
              }}
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
                  {showWeekNumbers && index % 7 === 0 ? <span className="absolute left-0.5 top-0.5 text-[7px] text-text-lo/45">W{Math.ceil((Number(date.slice(8)) + parseDateKey(date).getDay()) / 7)}</span> : null}
                  {isToday ? (
                    <span className="absolute bottom-0.5 size-1 rounded-full bg-ice" />
                  ) : null}
                  {day.getDate()}
                </button>
                <WorkloadWarning date={date} count={dateItems.length} />
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
                    onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                    selected={selectedIds.has(item.id)}
                    onSelect={onSelect}
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
  onReschedule,
  selectedIds,
  onSelect,
}: {
  startDate: string;
  endDateExclusive: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  onActivate: (item: CalendarItem) => void;
  onCreate: () => void;
  onReschedule: (item: CalendarItem, date: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
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
                onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                selected={selectedIds.has(item.id)}
                onSelect={onSelect}
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
            <div key={date} onDragOver={(event) => { if (event.dataTransfer.types.includes("text/tempo-calendar")) event.preventDefault(); }} onDrop={(event) => { const item = items.find((candidate) => candidate.id === event.dataTransfer.getData("text/tempo-calendar")); if (item) onReschedule(item, date); }}>
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
                    onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                    selected={selectedIds.has(item.id)}
                    onSelect={onSelect}
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
