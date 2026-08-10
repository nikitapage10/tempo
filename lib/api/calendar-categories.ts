import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CALENDAR_CATEGORIES,
  mergeCalendarCategories,
  normalizeCategoryColor,
  type CalendarCategory,
} from "@/lib/calendar/categories";

export type CalendarCategoriesResult = {
  categories: CalendarCategory[];
  customizable: boolean;
};

function categorySchemaMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("calendar_event_categories") === true
  );
}

export async function fetchCalendarCategories(): Promise<CalendarCategoriesResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_event_categories")
    .select("key,label,color,category_group,sort_order");
  if (error && categorySchemaMissing(error)) {
    return { categories: DEFAULT_CALENDAR_CATEGORIES, customizable: false };
  }
  if (error) throw error;
  const saved: CalendarCategory[] = (data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    color: normalizeCategoryColor(row.color),
    group: row.category_group === "source" ? "source" : "event",
    sort: Number(row.sort_order ?? 0),
    locked: DEFAULT_CALENDAR_CATEGORIES.some((category) => category.key === row.key),
  }));
  return { categories: mergeCalendarCategories(saved), customizable: true };
}

export async function saveCalendarCategory(category: CalendarCategory) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const payload = {
    user_id: user.id,
    key: category.key,
    label: category.label.trim().slice(0, 40),
    color: normalizeCategoryColor(category.color),
    category_group: category.group,
    sort_order: category.sort,
  };
  const { error } = await supabase
    .from("calendar_event_categories")
    .upsert(payload, { onConflict: "user_id,key" });
  if (error) throw error;
}

export async function deleteCalendarCategory(key: string) {
  const supabase = createClient();
  const builtIn = DEFAULT_CALENDAR_CATEGORIES.some((category) => category.key === key);
  if (builtIn) throw new Error("Built-in categories can be renamed or recolored, but not removed.");
  const { error: eventError } = await supabase
    .from("calendar_events")
    .update({ kind: "other" })
    .eq("kind", key);
  if (eventError) throw eventError;
  const { error } = await supabase
    .from("calendar_event_categories")
    .delete()
    .eq("key", key);
  if (error) throw error;
}
