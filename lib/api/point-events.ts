import { createClient } from "@/lib/supabase/client";
import type { AttributeKey, PointEvent } from "@/lib/gamification/attributes";

/**
 * Read-only client access to the point ledger. There is deliberately no
 * create/update/delete here — migration 087 grants select-only RLS, so
 * every write happens through a database trigger or the gamification API
 * routes' service-role client. See lib/gamification/context.ts for the
 * server-side equivalent.
 */
export async function fetchPointEvents(artistId: string): Promise<PointEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_point_events")
    .select("id, rule_key, attribute, points, subject_type, subject_id, occurred_at")
    .eq("artist_id", artistId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    ruleKey: r.rule_key,
    attribute: r.attribute as AttributeKey,
    points: r.points,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    occurredAt: r.occurred_at,
  }));
}

export async function fetchStageTransitionFlags(artistUserId: string): Promise<{
  hasMeasuredVelocity: boolean;
  velocityMeasuringSince: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_transitions")
    .select("source, direction, entered_at")
    .eq("user_id", artistUserId)
    .order("entered_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const firstForwardTrigger = rows.find((r) => r.source === "trigger" && r.direction === 1);
  return {
    hasMeasuredVelocity: !!firstForwardTrigger,
    velocityMeasuringSince: rows[0]?.entered_at ?? null,
  };
}
