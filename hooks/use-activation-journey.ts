import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  deriveActivationJourney,
  type ActivationJourney,
  type EligibleTrack,
} from "@/lib/activation/derive-journey";
import { fetchActivationGuidePreference } from "@/lib/api/activation-guide-preferences";

async function fetchFacts(spaceId: string, ownerId: string): Promise<{
  tracks: EligibleTrack[];
  warnings: string[];
}> {
  const supabase = createClient();
  const warnings: string[] = [];

  const { data: tracks, error: tracksError } = await supabase
    .from("tracks")
    .select("id, created_at, updated_at, next_action, next_action_due, blocked_reason, waiting_on")
    .eq("space_id", spaceId);
  if (tracksError || !tracks) {
    return { tracks: [], warnings: ["Could not load tracks."] };
  }
  if (tracks.length === 0) return { tracks: [], warnings };

  const trackIds = tracks.map((t) => t.id);

  const [sessionsRes, versionsRes, guestLinksRes, collaboratorsRes, commentsRes, decisionsRes] =
    await Promise.all([
      supabase.from("sessions").select("track_id").eq("status", "completed").in("track_id", trackIds),
      supabase.from("versions").select("track_id").in("track_id", trackIds),
      supabase.from("guest_review_links").select("track_id").in("track_id", trackIds),
      supabase.from("track_collaborators").select("track_id").eq("status", "active").in("track_id", trackIds),
      supabase
        .from("comments")
        .select("track_id, author_user_id, guest_name, resolved")
        .in("track_id", trackIds),
      supabase
        .from("version_decisions")
        .select("track_id, created_by_user_id, guest_name")
        .in("track_id", trackIds),
    ]);

  for (const [label, res] of [
    ["sessions", sessionsRes],
    ["versions", versionsRes],
    ["guest links", guestLinksRes],
    ["collaborators", collaboratorsRes],
    ["comments", commentsRes],
    ["decisions", decisionsRes],
  ] as const) {
    if (res.error) warnings.push(`Could not load ${label}.`);
  }

  const withCompletedSession = new Set((sessionsRes.data ?? []).map((r) => r.track_id));
  const withVersion = new Set((versionsRes.data ?? []).map((r) => r.track_id));
  const withGuestLink = new Set((guestLinksRes.data ?? []).map((r) => r.track_id));
  const withCollaborator = new Set((collaboratorsRes.data ?? []).map((r) => r.track_id));

  const externalComments = (commentsRes.data ?? []).filter(
    (c) => c.guest_name || (c.author_user_id && c.author_user_id !== ownerId)
  );
  const withFeedback = new Set(externalComments.map((c) => c.track_id));
  const withUnresolvedFeedback = new Set(
    externalComments.filter((c) => !c.resolved).map((c) => c.track_id)
  );

  for (const d of decisionsRes.data ?? []) {
    if (d.guest_name || (d.created_by_user_id && d.created_by_user_id !== ownerId)) {
      withFeedback.add(d.track_id);
    }
  }

  const eligible: EligibleTrack[] = tracks.map((t) => ({
    id: t.id,
    updatedAt: t.updated_at,
    createdAt: t.created_at,
    hasNextMove: Boolean(t.next_action || t.next_action_due || t.blocked_reason || t.waiting_on),
    nextMoveDueAt: t.next_action_due,
    isBlockedOrWaiting: Boolean(t.blocked_reason || t.waiting_on),
    hasCompletedFocusSession: withCompletedSession.has(t.id),
    hasVersion: withVersion.has(t.id),
    hasGuestLinkOrCollaborator: withGuestLink.has(t.id) || withCollaborator.has(t.id),
    hasFeedback: withFeedback.has(t.id),
    hasUnresolvedFeedback: withUnresolvedFeedback.has(t.id),
  }));

  return { tracks: eligible, warnings };
}

export function useActivationJourney(spaceId: string | undefined, artistId: string | undefined, ownerId: string | undefined) {
  const factsQuery = useQuery({
    queryKey: ["activation-facts", spaceId, ownerId],
    queryFn: () => fetchFacts(spaceId as string, ownerId as string),
    enabled: Boolean(spaceId && ownerId),
  });

  const prefQuery = useQuery({
    queryKey: ["activation-guide-preference", artistId],
    queryFn: () => fetchActivationGuidePreference(artistId as string),
    enabled: Boolean(artistId),
  });

  const journey: ActivationJourney | null = factsQuery.data
    ? deriveActivationJourney({ tracks: factsQuery.data.tracks, warnings: factsQuery.data.warnings })
    : null;

  const now = Date.now();
  const pref = prefQuery.data;
  const isHidden = Boolean(pref?.hidden_at);
  const isSnoozed = Boolean(pref?.snoozed_until && new Date(pref.snoozed_until).getTime() > now);

  return {
    journey,
    preference: pref ?? null,
    isHidden,
    isSnoozed,
    isLoading: factsQuery.isLoading || prefQuery.isLoading,
    refetch: () => {
      void factsQuery.refetch();
      void prefQuery.refetch();
    },
  };
}
