"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { CalendarEventEditor } from "@/components/calendar/event-editor";
import { CalendarCategoryManager } from "@/components/calendar/calendar-category-manager";
import { CalendarCategoryProvider } from "@/components/calendar/calendar-category-provider";
import { CalendarAgendaView } from "@/components/calendar/calendar-agenda-view";
import { CalendarAiScheduler } from "@/components/calendar/calendar-ai-scheduler";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CalendarDayPanel } from "@/components/calendar/calendar-day-panel";
import { CalendarSignalLine } from "@/components/calendar/calendar-signal-line";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarFiltersPopover } from "@/components/calendar/calendar-filters-popover";
import { CalendarOverflowMenu } from "@/components/calendar/calendar-overflow-menu";
import { CalendarTimeline } from "@/components/calendar/calendar-planning-panels";
import { AtcBackdrop } from "@/components/atc-backdrop";
import { useCalendarViewState } from "@/components/calendar/use-calendar-view-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useCalendarCategories, useCalendarData, useCalendarEventMutations } from "@/hooks/use-calendar";
import { useTaskMutations } from "@/hooks/use-tasks";
import { addDateKey, browserTimezone, zonedLocalToUtc } from "@/lib/calendar/date";
import type { ScheduleParseResult } from "@/lib/calendar/schedule-schema";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarItem,
  CalendarMilestoneStage,
  UnscheduledCalendarItem,
} from "@/lib/calendar/types";
import { deliverCalendarReminders } from "@/lib/api/calendar-events";
import { DEFAULT_CALENDAR_CATEGORIES } from "@/lib/calendar/categories";

export default function CalendarPage() {
  return (
    <React.Suspense fallback={<div className="glass h-[560px] animate-pulse" />}>
      <CalendarContent />
    </React.Suspense>
  );
}

function CalendarContent() {
  const { activeArtistId } = useActiveArtist();
  const { spaces, activeSpaceId } = useActiveSpace();
  const vs = useCalendarViewState();
  const { today } = vs;

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  const [eventDate, setEventDate] = React.useState(today);
  const [eventStartTime, setEventStartTime] = React.useState<string | null>(null);
  const [eventKind, setEventKind] = React.useState<CalendarEvent["kind"]>("other");
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventStage, setEventStage] = React.useState<CalendarMilestoneStage | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);

  const calendarMutations = useCalendarEventMutations();
  const categoriesQuery = useCalendarCategories();
  const taskMutations = useTaskMutations(activeSpaceId);

  const scopedSpaces = React.useMemo(
    () => (vs.scope === "all" ? spaces : spaces.filter((space) => space.id === activeSpaceId)),
    [vs.scope, spaces, activeSpaceId]
  );
  const spaceIds = React.useMemo(() => scopedSpaces.map((space) => space.id), [scopedSpaces]);
  const spaceLabels = React.useMemo(() => Object.fromEntries(spaces.map((space) => [space.id, space.name])), [spaces]);

  const calendarQuery = useCalendarData({
    artistId: activeArtistId,
    spaceIds,
    spaceLabels,
    rangeStart: vs.rangeStart,
    rangeEndExclusive: vs.rangeEndExclusive,
    today,
  });
  const data = calendarQuery.data;

  React.useEffect(() => {
    if (!data?.eventsAvailable) return;
    void deliverCalendarReminders().catch(() => undefined);
  }, [data?.eventsAvailable]);

  React.useEffect(() => {
    const eventId = vs.searchParams.get("event");
    if (!eventId || !data) return;
    const match = data.items.find((item) => item.source === "custom_event" && item.sourceId === eventId);
    if (match?.event) {
      setEditingEvent(match.event);
      setEventDate(match.date);
      setEventStartTime(null);
      setEditorOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs.searchParams, data]);

  const filteredItems = React.useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) =>
          vs.sourceFilters.has(item.sourceGroup) &&
          (vs.showCompleted || item.state !== "completed") &&
          (!vs.search.trim() ||
            `${item.title} ${item.subtitle ?? ""} ${item.relationLabel ?? ""} ${item.spaceLabel}`.toLowerCase().includes(vs.search.trim().toLowerCase()))
      ),
    [data?.items, vs.sourceFilters, vs.showCompleted, vs.search]
  );

  function createEvent(date = vs.selectedDate, time?: string) {
    if (data && !data.eventsAvailable) return;
    setEditingEvent(null);
    setEventDate(date);
    setEventStartTime(time ?? null);
    setEventKind("other");
    setEventTitle("");
    setEventStage(null);
    setEditorOpen(true);
  }

  function createMilestone(stage: CalendarMilestoneStage, date = vs.selectedDate) {
    setEditingEvent(null);
    setEventDate(date);
    setEventStartTime(null);
    setEventKind("milestone");
    setEventTitle(`${stage[0].toUpperCase()}${stage.slice(1)} milestone`);
    setEventStage(stage);
    setEditorOpen(true);
  }

  function activateItem(item: CalendarItem) {
    if (item.event) {
      setEditingEvent(item.event);
      setEventDate(item.date);
      setEventStartTime(null);
      setEditorOpen(true);
      vs.updateUrl({ event: item.event.id });
      return;
    }
    vs.router.push(item.destinationHref);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingEvent(null);
    vs.updateUrl({ event: null });
  }

  async function reschedule(item: CalendarItem, date: string, time?: string) {
    const hasDependents = !!item.event && (data?.items ?? []).some((candidate) => candidate.event?.dependency_event_id === item.event?.id);
    const cascadeDependencies = hasDependents && window.confirm("Move dependent milestones by the same amount?");
    await calendarMutations.reschedule.mutateAsync({ item, date, cascadeDependencies, time });
  }

  async function scheduleUnscheduled(item: UnscheduledCalendarItem, date: string) {
    await calendarMutations.schedule.mutateAsync({ item, date });
  }

  async function scheduleFromParsed(parsed: ScheduleParseResult) {
    if (parsed.isTask) {
      await taskMutations.create.mutateAsync({ title: parsed.title, due_date: parsed.date, space_id: activeSpaceId });
      return;
    }
    const zone = vs.displayTimezone || browserTimezone();
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
    const selected = filteredItems.filter((item) => vs.selectedIds.has(item.id));
    for (const item of selected) await reschedule(item, vs.bulkDate);
    vs.setSelectedIds(new Set());
    vs.setBulkDate("");
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
        space_id: release.spaceId,
        track_id: null,
        project_id: release.sourceId,
        title: step.title,
        kind: "milestone",
        description: `Generated from ${release.title}.`,
        location: null,
        all_day: true,
        start_date: addDateKey(release.date, step.offset),
        end_date: null,
        starts_at: null,
        ends_at: null,
        timezone: null,
        recurrence: "none",
        recurrence_until: null,
        reminder_minutes: step.offset === 0 ? [1440] : [],
        participants: [],
        links: [],
        attachment_urls: [],
        milestone_stage: step.stage,
        dependency_event_id: null,
        completed_at: null,
      });
    }
  }

  function selectDate(date: string) {
    vs.setSelectedDate(date);
    vs.setDayPanelOpen(true);
  }

  const showDayPanel = vs.view === "month" || vs.view === "week";

  return (
    <CalendarCategoryProvider categories={categoriesQuery.data?.categories ?? DEFAULT_CALENDAR_CATEGORIES}>
      {/* The ATC field, on its own canvas rather than the app-wide Spectra
          one, held behind an 85% scrim so the dates stay the brightest thing
          on the page. Fixed rather than absolute so it backs the whole
          content area and stays put as the page scrolls, and inset to clear
          the chrome it must not cover: the left rail (w-[220px] in
          components/app-shell.tsx) and the top and bottom edge strips, all of
          which are in normal flow and would otherwise lose to a positioned
          element. Falls back to a still gradient without WebGL2 or under
          reduced motion. */}
      <AtcBackdrop className="fixed inset-x-0 bottom-0 top-[var(--edge-strip-h)] z-0 md:bottom-[6px] md:left-[220px]" />

      <div className="relative z-[1] space-y-4">
        <PageHeader title="Calendar" subtitle="Deadlines, releases, and scheduled work." />

        <CalendarAiScheduler today={today} timezone={vs.displayTimezone} onSchedule={scheduleFromParsed} />

        <CalendarToolbar
          view={vs.view}
          onViewChange={vs.setView}
          selectedDate={vs.selectedDate}
          rangeStart={vs.rangeStart}
          rangeEndExclusive={vs.rangeEndExclusive}
          today={today}
          onMovePeriod={vs.movePeriod}
          onToday={() => vs.setSelectedDate(today)}
          search={vs.search}
          onSearchChange={vs.setSearch}
          displayTimezone={vs.displayTimezone}
          browserTimezone={browserTimezone()}
          onNewEvent={() => createEvent()}
          onNewMilestone={() => createMilestone("writing")}
          onReleasePlan={() => void generateReleasePlan()}
          releasePlanEnabled={filteredItems.some((item) => item.source === "release_date") && data?.eventsAvailable !== false}
          createDisabled={!spaceIds.length || data?.eventsAvailable === false}
          filtersSlot={
            <CalendarFiltersPopover
              sourceFilters={vs.sourceFilters}
              onToggleSource={vs.toggleSource}
              showCompleted={vs.showCompleted}
              onToggleCompleted={() => vs.setShowCompleted((value) => !value)}
              presets={vs.presets}
              onSavePreset={vs.savePreset}
              onApplyPreset={vs.applyPreset}
              onRenamePreset={vs.renamePreset}
              onDeletePreset={vs.deletePreset}
            />
          }
          overflowSlot={
            <CalendarOverflowMenu
              scope={vs.scope}
              onScopeChange={vs.setScope}
              activeSpaceName={spaces.find((space) => space.id === activeSpaceId)?.name ?? "Active space"}
              onOpenCategories={() => setCategoryManagerOpen(true)}
              showWeekNumbers={vs.showWeekNumbers}
              onShowWeekNumbersChange={vs.setShowWeekNumbers}
              weekStartsMonday={vs.weekStartsMonday}
              onWeekStartsMondayChange={vs.setWeekStartsMonday}
              displayTimezone={vs.displayTimezone}
              onDisplayTimezoneChange={vs.setDisplayTimezone}
              selectMode={vs.selectMode}
              onSelectModeChange={vs.setSelectMode}
              items={filteredItems}
            />
          }
        />

        <CalendarSignalLine items={filteredItems} unscheduled={data?.unscheduled ?? []} today={today} />

        {vs.selectedIds.size ? (
          <div className="glass-quiet flex flex-wrap items-center gap-2 border-ice/30 px-3 py-2">
            <span className="text-sm text-text-hi">{vs.selectedIds.size} selected</span>
            <input
              type="date"
              value={vs.bulkDate}
              onChange={(event) => vs.setBulkDate(event.target.value)}
              className="h-8 rounded-input border border-line bg-bg-2 px-2 font-mono text-xs text-text-hi"
            />
            <Button type="button" size="sm" disabled={!vs.bulkDate || calendarMutations.reschedule.isPending} onClick={() => void applyBulkDate()}>
              Move selected
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => vs.setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}

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

        {calendarQuery.isLoading ? (
          <div className="glass h-[560px] animate-pulse" />
        ) : calendarQuery.isError ? (
          <div className="glass flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
            <CalendarRange className="size-7 text-warn" />
            <p className="mt-3 text-sm text-text-hi">Calendar couldn’t load.</p>
            <p className="mt-1 text-xs text-text-lo">{calendarQuery.error instanceof Error ? calendarQuery.error.message : "Try again in a moment."}</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => void calendarQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              {vs.view === "timeline" ? (
                <CalendarTimeline
                  items={filteredItems}
                  showSpace={vs.scope === "all"}
                  displayTimezone={vs.displayTimezone}
                  onActivate={activateItem}
                  onCreateMilestone={createMilestone}
                />
              ) : vs.view === "month" ? (
                <CalendarMonthView
                  selectedDate={vs.selectedDate}
                  today={today}
                  items={filteredItems}
                  showSpace={vs.scope === "all"}
                  displayTimezone={vs.displayTimezone}
                  onSelectDate={selectDate}
                  onCreate={(date) => createEvent(date)}
                  onActivate={activateItem}
                  onReschedule={(item, date) => void reschedule(item, date)}
                  selectedIds={vs.selectedIds}
                  onSelect={(item, selected) =>
                    vs.setSelectedIds((current) => {
                      const next = new Set(current);
                      if (selected) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })
                  }
                  selectMode={vs.selectMode}
                  showWeekNumbers={vs.showWeekNumbers}
                  weekStartsMonday={vs.weekStartsMonday}
                  unscheduled={data?.unscheduled ?? []}
                  onSchedule={(item, date) => void scheduleUnscheduled(item, date)}
                  onMore={selectDate}
                />
              ) : vs.view === "week" ? (
                <CalendarWeekView
                  selectedDate={vs.selectedDate}
                  today={today}
                  items={filteredItems}
                  showSpace={vs.scope === "all"}
                  displayTimezone={vs.displayTimezone}
                  weekStartsMonday={vs.weekStartsMonday}
                  onSelectDate={selectDate}
                  onCreate={(date, time) => createEvent(date, time)}
                  onActivate={activateItem}
                  onReschedule={(item, date, time) => void reschedule(item, date, time)}
                  selectedIds={vs.selectedIds}
                  onSelect={(item, selected) =>
                    vs.setSelectedIds((current) => {
                      const next = new Set(current);
                      if (selected) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })
                  }
                  selectMode={vs.selectMode}
                  unscheduled={data?.unscheduled ?? []}
                  onSchedule={(item, date) => void scheduleUnscheduled(item, date)}
                />
              ) : (
                <CalendarAgendaView
                  startDate={vs.rangeStart}
                  endDateExclusive={vs.rangeEndExclusive}
                  today={today}
                  items={filteredItems}
                  showSpace={vs.scope === "all"}
                  displayTimezone={vs.displayTimezone}
                  onActivate={activateItem}
                  onCreate={() => createEvent()}
                  onReschedule={(item, date) => void reschedule(item, date)}
                  selectedIds={vs.selectedIds}
                  onSelect={(item, selected) =>
                    vs.setSelectedIds((current) => {
                      const next = new Set(current);
                      if (selected) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })
                  }
                />
              )}
            </div>

            {showDayPanel ? (
              <CalendarDayPanel
                date={vs.selectedDate}
                today={today}
                items={filteredItems}
                showSpace={vs.scope === "all"}
                displayTimezone={vs.displayTimezone}
                onActivate={activateItem}
                onReschedule={(item, date) => void reschedule(item, date)}
                selectedIds={vs.selectedIds}
                onSelect={(item, selected) =>
                  vs.setSelectedIds((current) => {
                    const next = new Set(current);
                    if (selected) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })
                }
                unscheduled={data?.unscheduled ?? []}
                onSchedule={(item, date) => void scheduleUnscheduled(item, date)}
                onOpenUnscheduled={(href) => vs.router.push(href)}
                onCreate={(date) => createEvent(date)}
                open={vs.dayPanelOpen}
                onClose={() => vs.setDayPanelOpen(false)}
              />
            ) : null}
          </div>
        )}
      </div>

      <CalendarEventEditor
        open={editorOpen}
        event={editingEvent}
        defaultDate={eventDate}
        defaultSpaceId={activeSpaceId ?? spaces[0]?.id ?? ""}
        spaces={spaces}
        relationOptions={data?.relationOptions ?? []}
        existingEvents={Array.from(new Map((data?.items ?? []).flatMap((item) => (item.event ? [[item.event.id, item.event] as const] : []))).values())}
        defaultKind={eventKind}
        defaultTitle={eventTitle}
        defaultMilestoneStage={eventStage}
        defaultTimezone={vs.displayTimezone}
        defaultStartTime={eventStartTime}
        onClose={closeEditor}
      />
      <CalendarCategoryManager open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />
    </CalendarCategoryProvider>
  );
}
