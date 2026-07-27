import { createClient } from "@/lib/supabase/client";
import type { LayoutTemplate } from "@/lib/types";

const TABLE = "user_workspace_layout_templates";

/** True when the failure is just migration 013 not being applied yet. */
function isMissingTable(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "42P01" ||
    /user_workspace_layout_templates|schema cache/i.test(error?.message ?? "")
  );
}

/**
 * Saved layouts for the signed-in user. Returns [] rather than throwing when
 * migration 013 hasn't been run, so the layout editor still works without it.
 */
export async function listLayoutTemplates(): Promise<LayoutTemplate[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function saveLayoutTemplate(input: {
  name: string;
  layout: { left: string[][]; right: string[][]; leftPct?: number };
}): Promise<LayoutTemplate> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Give the template a name.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userData.user.id, name, layout: input.layout })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        "Templates aren’t set up yet — run migration 013 in Supabase, then try again."
      );
    }
    if (error.code === "23505") {
      throw new Error(`You already have a template called “${name}”.`);
    }
    throw new Error(error.message);
  }
  return data;
}

/** Overwrites an existing template's arrangement, keeping its name. */
export async function updateLayoutTemplate(
  id: string,
  layout: { left: string[][]; right: string[][]; leftPct?: number }
): Promise<LayoutTemplate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ layout, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLayoutTemplate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
