import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVATION_DEFINITION_VERSION } from "@/lib/activation/derive-journey";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
/** Cohorts smaller than this are folded into "Other" rather than shown individually (§7.1). */
const MIN_COHORT_SIZE = 5;

/**
 * Aggregate-only Activation + Pulse metrics for the existing Admin
 * analytics surface — 01-PRODUCT-AND-UX-SPEC.md §7.1/§9. No per-member
 * drilldown, no creative content, ever: every query here selects only
 * counts, event names, and timestamps.
 */
export async function GET() {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);

  try {
    const service = createAdminClient();
    const now = Date.now();

    const [
      { data: authPage },
      { data: milestoneEvents },
      { data: guideEvents },
      { data: notifPrefs },
      { data: deliveries },
    ] = await Promise.all([
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      service
        .from("product_events")
        .select("user_id, event_name, occurred_at")
        .in("event_name", ["first_track_created", "focus_session_started", "focus_session_completed"]),
      service
        .from("product_events")
        .select("event_name")
        .in("event_name", [
          "activation_guide_viewed",
          "activation_guide_actioned",
          "activation_guide_snoozed",
          "activation_guide_hidden",
          "activation_loop_completed",
        ]),
      service.from("notification_preferences").select("digest_frequency"),
      service.from("notification_deliveries").select("status"),
    ]);

    const users = authPage?.users ?? [];
    const eligible = users.length;

    const distinctUsersWithEvent = (name: string): number =>
      new Set((milestoneEvents ?? []).filter((e) => e.event_name === name).map((e) => e.user_id)).size;

    // D1/D7/D30 return: fraction of members whose most recent sign-in is at
    // least N days after their account was created (i.e., they came back).
    const returnRate = (days: number): number => {
      const withReturn = users.filter((u) => {
        if (!u.last_sign_in_at) return false;
        return new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() >= days * DAY_MS;
      }).length;
      return eligible > 0 ? withReturn / eligible : 0;
    };

    const guideCounts = {
      viewed: (guideEvents ?? []).filter((e) => e.event_name === "activation_guide_viewed").length,
      actioned: (guideEvents ?? []).filter((e) => e.event_name === "activation_guide_actioned").length,
      snoozed: (guideEvents ?? []).filter((e) => e.event_name === "activation_guide_snoozed").length,
      hidden: (guideEvents ?? []).filter((e) => e.event_name === "activation_guide_hidden").length,
      loopCompleted: (guideEvents ?? []).filter((e) => e.event_name === "activation_loop_completed").length,
    };

    const optedIn = (notifPrefs ?? []).filter((p) => p.digest_frequency !== "off").length;
    const totalPrefRows = (notifPrefs ?? []).length;

    const deliveryCount = (status: string): number =>
      (deliveries ?? []).filter((d) => d.status === status).length;

    // Small-cohort suppression: fold anything below the threshold into a
    // single reported floor rather than showing an exact tiny number.
    const suppressSmall = (n: number) => (n > 0 && n < MIN_COHORT_SIZE ? null : n);

    return adminJson({
      definitionVersion: ACTIVATION_DEFINITION_VERSION,
      computedAt: new Date().toISOString(),
      funnel: {
        eligibleAccounts: eligible,
        firstTrackCreated: suppressSmall(distinctUsersWithEvent("first_track_created")),
        focusSessionStarted: suppressSmall(distinctUsersWithEvent("focus_session_started")),
        focusSessionCompleted: suppressSmall(distinctUsersWithEvent("focus_session_completed")),
        // Not yet instrumented (AR-3 shipped only the core funnel start) —
        // reported explicitly rather than omitted or shown as zero.
        instrumentedMilestones: ["first_track_created", "focus_session_started", "focus_session_completed"],
        pendingMilestones: [
          "workflow_intent_set",
          "version_upload_completed",
          "guest_link_created",
          "external_feedback_received",
        ],
      },
      returnRates: { d1: returnRate(1), d7: returnRate(7), d30: returnRate(30) },
      guide: guideCounts,
      pulse: {
        optedIn,
        totalWithPreferences: totalPrefRows,
        sent: deliveryCount("sent"),
        noContent: deliveryCount("no_content"),
        failed: deliveryCount("failed"),
        suppressed: deliveryCount("suppressed"),
      },
    });
  } catch {
    return adminError("Couldn’t load activation/Pulse analytics.", 500);
  }
}
