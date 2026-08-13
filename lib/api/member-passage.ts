import { createClient } from "@/lib/supabase/client";
import {
  rowToPassage,
  type MemberPassage,
  type MemberPassageRow,
  type PassageDraftPatch,
  type PassageInterpretation,
} from "@/lib/passage/types";
import { sanitizePassageInterpretation } from "@/lib/passage/validation";

/**
 * Client-side access to the caller's own PASSAGE row.
 *
 * Every call is scoped by RLS to `user_id = auth.uid()` (migration 094), so
 * there is no way to reach another member's answers from the browser.
 */

const COLUMNS =
  "status, current_step, display_name, role_titles, role_title_other, entry_text, supports_text, function_text, headline, intro, story_sections, completed_at, updated_at";

export async function fetchMemberPassage(): Promise<MemberPassage | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("member_passages")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPassage(data as MemberPassageRow) : null;
}

export async function saveMemberPassageDraft(patch: PassageDraftPatch): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const row: Record<string, unknown> = { user_id: user.id };
  if (patch.currentStep !== undefined) row.current_step = patch.currentStep;
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.roleTitles !== undefined) row.role_titles = patch.roleTitles;
  if (patch.roleTitleOther !== undefined) row.role_title_other = patch.roleTitleOther;
  if (patch.entryText !== undefined) row.entry_text = patch.entryText;
  if (patch.supportsText !== undefined) row.supports_text = patch.supportsText;
  if (patch.functionText !== undefined) row.function_text = patch.functionText;
  if (patch.interpretation !== undefined) {
    const clean = patch.interpretation
      ? sanitizePassageInterpretation(patch.interpretation)
      : null;
    row.headline = clean?.headline ?? null;
    row.intro = clean?.intro ?? null;
    row.story_sections = clean?.storySections ?? [];
  }

  const { error } = await supabase
    .from("member_passages")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/** Server-side writing. The model and the key never touch the browser. */
export async function requestPassageInterpretation(input: {
  displayName: string;
  roles: string[];
  entry: string;
  supports: string;
  work: string;
}): Promise<PassageInterpretation> {
  const res = await fetch("/api/member-passage/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as
    | { interpretation?: unknown; error?: string }
    | null;
  if (!res.ok) throw new Error(body?.error || "TEMPO couldn't read that just now.");
  return sanitizePassageInterpretation(body?.interpretation);
}

/**
 * "Skip for now" from anywhere in the flow. The draft is deliberately left
 * intact, so skipping costs nothing and the answers are still there if they
 * come back to it from Settings.
 */
export async function skipMemberPassage(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const { error } = await supabase
    .from("member_passages")
    .upsert({ user_id: user.id, status: "skipped" }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function completeMemberPassage(input: {
  displayName: string;
  roleTitles: string[];
  roleTitleOther: string;
  entryText: string;
  supportsText: string;
  functionText: string;
  interpretation: PassageInterpretation;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const clean = sanitizePassageInterpretation(input.interpretation);
  const { error } = await supabase.from("member_passages").upsert(
    {
      user_id: user.id,
      status: "complete",
      current_step: "complete",
      display_name: input.displayName || null,
      role_titles: input.roleTitles,
      role_title_other: input.roleTitleOther || null,
      entry_text: input.entryText || null,
      supports_text: input.supportsText || null,
      function_text: input.functionText || null,
      headline: clean.headline || null,
      intro: clean.intro || null,
      story_sections: clean.storySections,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
