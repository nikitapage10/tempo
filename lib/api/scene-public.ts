import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Scene, SceneLibraryItem, ScenePage, SceneSection, SceneShowcaseItem } from "@/lib/types";

export async function fetchPublicScene(slug: string): Promise<{ scene: Scene; sections: SceneSection[]; pages: ScenePage[]; library: SceneLibraryItem[]; showcase: SceneShowcaseItem[] } | null> {
  const supabase = createAdminClient();
  const { data: scene } = await supabase.from("scenes").select("*").eq("slug", slug).or("published_at.not.is.null,visibility.eq.listed").is("archived_at", null).maybeSingle();
  if (!scene) return null;
  const { data: sectionRows } = await supabase.from("scene_sections").select("*").eq("scene_id", scene.id).eq("public_visible", true).is("archived_at", null).order("sort_order");
  const sections = sectionRows ?? [];
  const ids = sections.map((section) => section.id);
  if (!ids.length) return { scene: scene as Scene, sections: [], pages: [], library: [], showcase: [] };
  const [pages, library, showcase] = await Promise.all([
    supabase.from("scene_pages").select("*").in("section_id", ids).not("published_at", "is", null),
    supabase.from("scene_library_items").select("*").in("section_id", ids).not("published_at", "is", null).is("archived_at", null),
    supabase.from("scene_showcase_items").select("*").in("section_id", ids).eq("status", "published").eq("visibility", "public"),
  ]);
  return { scene: scene as Scene, sections: sections as SceneSection[], pages: (pages.data ?? []) as ScenePage[], library: (library.data ?? []) as SceneLibraryItem[], showcase: (showcase.data ?? []) as SceneShowcaseItem[] };
}
