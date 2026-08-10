"use client";

import * as React from "react";
import { DEFAULT_CALENDAR_CATEGORIES, type CalendarCategory } from "@/lib/calendar/categories";

const CalendarCategoryContext = React.createContext<CalendarCategory[]>(DEFAULT_CALENDAR_CATEGORIES);

export function CalendarCategoryProvider({ categories, children }: { categories: CalendarCategory[]; children: React.ReactNode }) {
  return <CalendarCategoryContext.Provider value={categories}>{children}</CalendarCategoryContext.Provider>;
}

export function useCalendarCategoryPalette() {
  return React.useContext(CalendarCategoryContext);
}
