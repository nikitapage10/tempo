import { createClient } from "@/lib/supabase/client";
import {
  rowToPassage,
  type MemberPassage,
  type MemberPassageRow,
  type PassageDraftPatch,
} from "@/lib/passage/types";

/**
 * Client-side access to the caller's own PASSAGE row.
 *
 * Every call is scoped by RLS to `user_id = auth.uid()` (migration 094), so
 * there is no way to reach another member's answers from the browser.
 */

export async function fetchMemberPassage(): Promise<MemberPassage | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("member_passages")
    .select("status, current_step, role_title, role_title_other, entry_text, supports_text, function_text, completed_at, updated_at")
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
  if (patch.roleTitle !== undefined) row.role_title = patch.roleTitle;
  if (patch.roleTitleOther !== undefined) row.role_title_other = patch.roleTitleOther;
  if (patch.entryText !== undefined) row.entry_text = patch.entryText;
  if (patch.supportsText !== undefined) row.supports_text = patch.supportsText;
  if (patch.functionText !== undefined) row.function_text = patch.functionText;

  const { error } = await supabase
    .from("member_passages")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
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
  roleTitle: string;
  roleTitleOther: string;
  entryText: string;
  supportsText: string;
  functionText: string;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const { error } = await supabase
    .from("member_passages")
    .upsert(
      {
        user_id: user.id,
        status: "complete",
        current_step: "complete",
        role_title: input.roleTitle || null,
        role_title_other: input.roleTitleOther || null,
        entry_text: input.entryText || null,
        supports_text: input.supportsText || null,
        function_text: input.functionText || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
