import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { ModerationReason } from "@/lib/api/reports";
import type { SceneModerationLogEntry } from "@/lib/types";

async function postReport(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "Couldn’t send the report.");
  return result as { ok: true; id: string };
}

export function createSceneReport(input: {
  reporterProfileId: string;
  sceneId: string;
  targetType: "scene_post" | "scene_comment" | "scene";
  targetId: string;
  reason: ModerationReason;
  details?: string;
}) {
  return postReport("/api/scenes/report", input);
}

/** A scene manager's own moderation history — pin/remove/ban/role changes,
 *  shaped like admin_audit_log. Visible only to that scene's managers. */
export async function fetchSceneModerationLog(
  sceneId: string
): Promise<SceneModerationLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_moderation_log")
    .select("*")
    .eq("scene_id", sceneId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as SceneModerationLogEntry[];
}

/** Open escalations for this scene, for the Reports nav badge. */
export async function fetchOpenSceneReportCount(sceneId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("scene_id", sceneId)
    .eq("status", "open");
  if (error) {
    if (isMissingSceneSchema(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

/** A manager escalating removed/flagged content into the platform operator's
 *  /admin/reports queue — separate from a member's own report above. */
export async function escalateSceneReport(input: {
  sceneId: string;
  targetType: "scene_post" | "scene_comment";
  targetId: string;
  reason: string;
  details?: string;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("escalate_scene_report", {
    p_scene_id: input.sceneId,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details ?? null,
  });
  if (error) throw error;
  return data as string;
}
