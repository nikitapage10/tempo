"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDateKey, browserTimezone, monthGridStart, shiftMonth, shiftWeek } from "@/lib/calendar/date";
import { validDateKey } from "@/lib/calendar/items";
import type { CalendarSourceGroup } from "@/lib/calendar/types";
import { localDateString } from "@/lib/format";

export type CalendarView = "month" | "week" | "agenda" | "timeline";
export type CalendarScope = "space" | "all";

export const SOURCE_FILTERS: { value: CalendarSourceGroup; label: string }[] = [
  { value: "tasks", label: "Tasks" },
  { value: "tracks", label: "Track dates" },
  { value: "projects", label: "Projects" },
  { value: "releases", label: "Releases" },
  { value: "events", label: "Events" },
];

export type CalendarPreset = {
  id: string;
  name: string;
  view: CalendarView;
  scope: CalendarScope;
  sources: CalendarSourceGroup[];
  showCompleted: boolean;
};

const VIEWS: CalendarView[] = ["month", "week", "agenda", "timeline"];

function isView(value: string | null): value is CalendarView {
  return !!value && (VIEWS as string[]).includes(value);
}

/**
 * Owns every piece of view-level calendar state: URL-synced (view, date,
 * scope) and locally/localStorage-persisted (filters, presets, display
 * options). Pulled out of the page so the page itself stays about data
 * wiring and rendering, not 17 useState calls.
 */
export function useCalendarViewState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = localDateString();

  const requestedView = searchParams.get("view");
  const requestedDate = searchParams.get("date");
  const [view, setViewState] = React.useState<CalendarView>(isView(requestedView) && requestedView !== "month" ? requestedView : "month");
  const [selectedDate, setSelectedDateState] = React.useState(
    validDateKey(requestedDate) ? requestedDate : today
  );
  const [scope, setScopeState] = React.useState<CalendarScope>(
    searchParams.get("scope") === "all" ? "all" : "space"
  );
  const [sourceFilters, setSourceFilters] = React.useState<Set<CalendarSourceGroup>>(
    () => new Set(SOURCE_FILTERS.map((filter) => filter.value))
  );
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);
  const [bulkDate, setBulkDate] = React.useState("");
  const [presets, setPresets] = React.useState<CalendarPreset[]>([]);
  const [showWeekNumbers, setShowWeekNumbers] = React.useState(false);
  const [weekStartsMonday, setWeekStartsMonday] = React.useState(true);
  const [displayTimezone, setDisplayTimezoneState] = React.useState(browserTimezone());
  const [dayPanelOpen, setDayPanelOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("tempo-calendar-presets");
      if (saved) {
        const parsed = JSON.parse(saved) as CalendarPreset[];
        // Backfill ids for presets saved before rename/delete existed.
        setPresets(parsed.map((preset, index) => ({ ...preset, id: preset.id ?? `legacy-${index}` })));
      }
      setShowWeekNumbers(window.localStorage.getItem("tempo-calendar-week-numbers") === "true");
      setWeekStartsMonday(window.localStorage.getItem("tempo-calendar-week-start") !== "sunday");
      const savedZone = window.localStorage.getItem("tempo-calendar-timezone");
      if (savedZone) setDisplayTimezoneState(savedZone);
    } catch {
      /* local preferences are best-effort */
    }
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

  const setView = React.useCallback(
    (next: CalendarView) => {
      setViewState(next);
      updateUrl({ view: next === "month" ? null : next });
    },
    [updateUrl]
  );

  const setSelectedDate = React.useCallback(
    (next: string) => {
      setSelectedDateState(next);
      updateUrl({ date: next === today ? null : next });
    },
    [today, updateUrl]
  );

  const setScope = React.useCallback(
    (next: CalendarScope) => {
      setScopeState(next);
      updateUrl({ scope: next === "space" ? null : next });
    },
    [updateUrl]
  );

  const setDisplayTimezone = React.useCallback((zone: string) => {
    setDisplayTimezoneState(zone);
    try {
      window.localStorage.setItem("tempo-calendar-timezone", zone);
    } catch {
      /* best-effort */
    }
  }, []);

  const setShowWeekNumbersPersisted = React.useCallback((value: boolean) => {
    setShowWeekNumbers(value);
    try {
      window.localStorage.setItem("tempo-calendar-week-numbers", String(value));
    } catch {
      /* best-effort */
    }
  }, []);

  const setWeekStartsMondayPersisted = React.useCallback((value: boolean) => {
    setWeekStartsMonday(value);
    try {
      window.localStorage.setItem("tempo-calendar-week-start", value ? "monday" : "sunday");
    } catch {
      /* best-effort */
    }
  }, []);

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

  function persistPresets(next: CalendarPreset[]) {
    setPresets(next);
    try {
      window.localStorage.setItem("tempo-calendar-presets", JSON.stringify(next));
    } catch {
      /* best-effort */
    }
  }

  function savePreset(name?: string) {
    const next: CalendarPreset = {
      id: `${Date.now()}`,
      name: name?.trim() || `Preset ${presets.length + 1}`,
      view,
      scope,
      sources: Array.from(sourceFilters),
      showCompleted,
    };
    persistPresets([...presets, next]);
  }

  function renamePreset(id: string, name: string) {
    persistPresets(presets.map((preset) => (preset.id === id ? { ...preset, name: name.trim() || preset.name } : preset)));
  }

  function deletePreset(id: string) {
    persistPresets(presets.filter((preset) => preset.id !== id));
  }

  function applyPreset(preset: CalendarPreset) {
    setView(preset.view);
    setScope(preset.scope);
    setSourceFilters(new Set(preset.sources));
    setShowCompleted(preset.showCompleted);
  }

  function movePeriod(delta: number) {
    if (view === "month") setSelectedDate(shiftMonth(selectedDate, delta));
    else if (view === "week") setSelectedDate(shiftWeek(selectedDate, delta, weekStartsMonday));
    else setSelectedDate(addDateKey(selectedDate, delta * 90));
  }

  const rangeStart = view === "month" ? monthGridStart(selectedDate) : selectedDate;
  const rangeEndExclusive =
    view === "month"
      ? addDateKey(rangeStart, 42)
      : view === "week"
        ? addDateKey(rangeStart, 7)
        : addDateKey(rangeStart, 90);

  return {
    today,
    searchParams,
    router,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    scope,
    setScope,
    sourceFilters,
    setSourceFilters,
    toggleSource,
    showCompleted,
    setShowCompleted,
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    selectMode,
    setSelectMode,
    bulkDate,
    setBulkDate,
    presets,
    savePreset,
    renamePreset,
    deletePreset,
    applyPreset,
    showWeekNumbers,
    setShowWeekNumbers: setShowWeekNumbersPersisted,
    weekStartsMonday,
    setWeekStartsMonday: setWeekStartsMondayPersisted,
    displayTimezone,
    setDisplayTimezone,
    dayPanelOpen,
    setDayPanelOpen,
    movePeriod,
    rangeStart,
    rangeEndExclusive,
    updateUrl,
  };
}
