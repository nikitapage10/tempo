import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OriginRoot } from "@/components/origin/origin-root";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Origin — TEMPO",
};

/**
 * /origin — the first-time artist onboarding.
 *
 * Deliberately outside the (app) route group: no rail, no toolbar, no search,
 * no assistant, no boot intro. ORIGIN is the introduction, so the normal chrome
 * would be a second one talking over it.
 */
export default async function OriginPage({
  searchParams,
}: {
  searchParams: { revisit?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Whether Import is still owed decides where "Enter TEMPO" leads. A committed
  // or cancelled session counts as dealt with; anything else means it's pending.
  const { data: imports } = await supabase
    .from("onboarding_imports")
    .select("status")
    .in("status", ["completed", "cancelled"])
    .limit(1);

  const importPending = (imports?.length ?? 0) === 0;

  return (
    <OriginRoot importPending={importPending} revisit={searchParams.revisit === "1"} />
  );
}
