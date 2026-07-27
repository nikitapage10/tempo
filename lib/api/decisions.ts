import { createClient } from "@/lib/supabase/client";
import type { DecisionArea, DecisionType, VersionDecision } from "@/lib/types";

export async function fetchDecisions(trackId: string): Promise<VersionDecision[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("version_decisions")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDecisionsForVersion(
  versionId: string
): Promise<VersionDecision[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("version_decisions")
    .select("*")
    .eq("version_id", versionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CreateDecisionInput = {
  trackId: string;
  versionId: string;
  decisionType: DecisionType;
  decisionArea?: DecisionArea;
  note?: string | null;
  guestName?: string | null;
  guestLinkId?: string | null;
};

/** Decisions are append-only — a new row is created for every call, never updated or deleted. */
export async function createDecision(
  input: CreateDecisionInput
): Promise<VersionDecision> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("version_decisions")
    .insert({
      track_id: input.trackId,
      version_id: input.versionId,
      decision_type: input.decisionType,
      decision_area: input.decisionArea ?? "general",
      note: input.note?.trim() || null,
      created_by_user_id: userData.user?.id ?? null,
      guest_name: input.guestName ?? null,
      guest_link_id: input.guestLinkId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
