import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CHECKLIST_TEMPLATES } from "@/lib/constants";
import type { ChecklistTemplate, TemplateItem } from "@/lib/types";

function normalizeTemplate(row: {
  id: string;
  user_id: string;
  name: string;
  items: unknown;
  created_at: string;
}): ChecklistTemplate {
  const raw = Array.isArray(row.items) ? row.items : [];
  const items: TemplateItem[] = raw
    .map((item, i) => {
      if (
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof (item as { text: unknown }).text === "string"
      ) {
        const sort =
          "sort" in item && typeof (item as { sort: unknown }).sort === "number"
            ? (item as { sort: number }).sort
            : i;
        return { text: (item as { text: string }).text, sort };
      }
      return null;
    })
    .filter((x): x is TemplateItem => x != null)
    .sort((a, b) => a.sort - b.sort);

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    items,
    created_at: row.created_at,
  };
}

export async function fetchTemplates(): Promise<ChecklistTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeTemplate);
}

export async function createTemplate(
  name: string,
  items: TemplateItem[]
): Promise<ChecklistTemplate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      name,
      items: items.map((item, i) => ({
        text: item.text,
        sort: item.sort ?? i,
      })),
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeTemplate(data);
}

/** Seed the four built-in templates when the user has none. */
export async function ensureDefaultTemplates(): Promise<ChecklistTemplate[]> {
  const existing = await fetchTemplates();
  if (existing.length > 0) return existing;

  const created: ChecklistTemplate[] = [];
  for (const tmpl of DEFAULT_CHECKLIST_TEMPLATES) {
    const items = tmpl.items.map((text, sort) => ({ text, sort }));
    const row = await createTemplate(tmpl.name, items);
    created.push(row);
  }
  return created;
}
