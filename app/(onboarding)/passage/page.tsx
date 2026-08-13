import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PassageExperience } from "@/components/passage/passage-experience";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome — TEMPO",
};

/**
 * /passage — first-time onboarding for someone formally invited by an admin
 * as a team member (not an artist). Deliberately outside the (app) route
 * group, same as /origin: no rail, no toolbar, no assistant.
 *
 * Eligibility reads through the service client because member_onboarding
 * carries no browser-facing RLS policy (see migration 056) — only the
 * server, here and in /api/onboarding, may read it directly.
 */
export default async function PassagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createAdminClient();
  const { data: onboarding } = await service
    .from("member_onboarding")
    .select("member_role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Only someone redeemed as a formal admin "team member" invite ever sees
  // this — an artist-invited teammate's account creation stays plain, per
  // product decision, and skips straight to the dashboard.
  if (onboarding?.member_role !== "team_member") redirect("/");

  const { data: passage } = await service
    .from("member_passages")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (passage?.status === "complete" || passage?.status === "skipped") redirect("/");

  return <PassageExperience />;
}
