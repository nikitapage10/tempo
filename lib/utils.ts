import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Pulls a human-readable message out of a caught value. Duck-typed
 * (`"message" in err`) rather than `instanceof Error`, because a thrown
 * Supabase/PostgREST error was observed NOT satisfying `instanceof Error` in
 * at least one real case (Scenes creation, RLS 42501) despite
 * `PostgrestError` extending `Error` in source — root cause unconfirmed
 * (possibly a duplicated postgrest-js module instance elsewhere in the
 * dependency tree), but this check works regardless of which is true.
 */
/** One or two letters standing in for a name — the fallback avatar everywhere identity has no photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function errorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message.trim()
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
