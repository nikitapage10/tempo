import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTeamMemberAccount, passageFinished } from "@/lib/auth/passage-gate";
import { PassageExperience } from "@/components/passage/passage-experience";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome to TEMPO",
};

/**
 * /passage — first-time onboarding for anyone joining as a team member,
 * whether an admin invited them from the console or an artist added them to
 * their team. Deliberately outside the (app) route group, same as /origin:
 * no rail, no toolbar, no assistant.
 *
 * Track collaborators are not team members and never land here — see
 * lib/auth/passage-gate.ts for the whole rule.
 */
export default async function PassagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [onboardingRes, membershipRes, passageRes] = await Promise.all([
    supabase
      .from("member_onboarding")
      .select("member_role")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("artist_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("member_passages")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Migration 094 not applied — nothing here could save, so send them on
  // rather than into a film that ends on an error.
  if (passageRes.error) redirect("/");
  if (passageFinished(passageRes.data?.status ?? null)) redirect("/");
  if (
    !isTeamMemberAccount({
      platformRole: onboardingRes.data?.member_role ?? null,
      hasTeamMembership: !!membershipRes.data,
    })
  ) {
    redirect("/");
  }

  return <PassageExperience />;
}
