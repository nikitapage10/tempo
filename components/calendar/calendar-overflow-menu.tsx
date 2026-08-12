"use client";

import * as React from "react";
import { HeaderMenu } from "@/components/ui/header-menu";
import { Button } from "@/components/ui/button";
import { commonTimezones, utcOffsetLabel } from "@/lib/calendar/date";
import { exportCalendarCsv } from "@/components/calendar/calendar-planning-panels";
import type { CalendarItem } from "@/lib/calendar/types";

export function CalendarOverflowMenu({
  scope,
  onScopeChange,
  activeSpaceName,
  onOpenCategories,
  showWeekNumbers,
  onShowWeekNumbersChange,
  weekStartsMonday,
  onWeekStartsMondayChange,
  displayTimezone,
  onDisplayTimezoneChange,
  selectMode,
  onSelectModeChange,
  items,
}: {
  scope: "space" | "all";
  onScopeChange: (scope: "space" | "all") => void;
  activeSpaceName: string;
  onOpenCategories: () => void;
  showWeekNumbers: boolean;
  onShowWeekNumbersChange: (value: boolean) => void;
  weekStartsMonday: boolean;
  onWeekStartsMondayChange: (value: boolean) => void;
  displayTimezone: string;
  onDisplayTimezoneChange: (zone: string) => void;
  selectMode: boolean;
  onSelectModeChange: (value: boolean) => void;
  items: CalendarItem[];
}) {
  const timezones = React.useMemo(() => commonTimezones(), []);

  return (
    <HeaderMenu label="More" panelWidth={280}>
      <div>
        <span className="label-mono text-[11px] text-text-lo/70">Scope</span>
        <select
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as "space" | "all")}
          aria-label="Calendar scope"
          className="mt-1 h-8 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
        >
          <option value="space">{activeSpaceName}</option>
          <option value="all">All spaces</option>
        </select>
      </div>

      <div>
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={onOpenCategories}>
          Manage categories
        </Button>
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-text-hi">
        Select multiple
        <input type="checkbox" checked={selectMode} onChange={(event) => onSelectModeChange(event.target.checked)} className="size-4 accent-[var(--ice)]" />
      </label>

      <div className="border-t border-line/60 pt-2">
        <span className="label-mono text-[11px] text-text-lo/70">Calendar settings</span>
        <label className="mt-1.5 flex items-center justify-between gap-2 text-xs text-text-hi">
          Week numbers
          <input type="checkbox" checked={showWeekNumbers} onChange={(event) => onShowWeekNumbersChange(event.target.checked)} className="size-4 accent-[var(--ice)]" />
        </label>
        <div className="mt-2">
          <span className="text-xs text-text-lo">First day of week</span>
          <select
            value={weekStartsMonday ? "monday" : "sunday"}
            onChange={(event) => onWeekStartsMondayChange(event.target.value === "monday")}
            aria-label="First day of week"
            className="mt-1 h-8 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
        <div className="mt-2">
          <span className="text-xs text-text-lo">Display timezone</span>
          <select
            value={displayTimezone}
            onChange={(event) => onDisplayTimezoneChange(event.target.value)}
            aria-label="Calendar display timezone"
            className="mt-1 h-8 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
          >
            {(timezones.includes(displayTimezone) ? timezones : [displayTimezone, ...timezones]).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")} · {utcOffsetLabel(zone)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-line/60 pt-2">
        <span className="label-mono text-[11px] text-text-lo/70">Export</span>
        <div className="mt-1.5 flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={() => exportCalendarCsv(items)}>
            CSV
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </div>
    </HeaderMenu>
  );
}
