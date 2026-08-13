import { redirect } from "next/navigation";
import { ActiveArtistProvider } from "@/components/active-artist-provider";
import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";
import { ArtistThemeProvider } from "@/components/artist-theme-provider";
import { LightfieldDriver } from "@/components/lightfield-driver";
import { IntroPreflight } from "@/components/intro-preflight";
import { GlobalPlayerProvider } from "@/components/player/global-player-provider";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownedArtists: { origin_status: string | null; workspace_kind?: string | null }[] | null =
    null;
  let ownedError: { message?: string } | null = null;
  if (user) {
    const first = await supabase
      .from("artists")
      .select("origin_status, workspace_kind")
      .eq("user_id", user.id)
      .order("sort", { ascending: true });
    if (first.error && /workspace_kind/i.test(first.error.message)) {
      const retry = await supabase
        .from("artists")
        .select("origin_status")
        .eq("user_id", user.id)
        .order("sort", { ascending: true });
      ownedArtists = retry.data;
      ownedError = retry.error;
    } else {
      ownedArtists = first.data;
      ownedError = first.error;
    }
  }

  const { data: membership } = user
    ? await supabase
        .from("artist_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Origin is for *music* artists the signed-in person owns. A personal
  // workspace (team member home) and an active team membership must not
  // trap anyone in onboarding. A brand-new account with no owned row and
  // no membership still goes to Origin so the default artist can be created.
  const musicOwned = (ownedArtists ?? []).filter(
    (row) => (row.workspace_kind ?? "artist") !== "personal"
  );
  const unfinishedMusic = musicOwned.find(
    (row) =>
      row.origin_status === "not_started" || row.origin_status === "in_progress"
  );

  if (!ownedError && unfinishedMusic) {
    redirect("/origin");
  }
  if (
    !ownedError &&
    musicOwned.length === 0 &&
    !(ownedArtists ?? []).some((row) => row.workspace_kind === "personal") &&
    !membership
  ) {
    redirect("/origin");
  }

  return (
    <>
      <IntroPreflight />
      <ActiveArtistProvider>
        <ArtistThemeProvider>
          <ActiveSpaceProvider>
            <LightfieldDriver />
            <GlobalPlayerProvider>
              <AppShell>{children}</AppShell>
            </GlobalPlayerProvider>
          </ActiveSpaceProvider>
        </ArtistThemeProvider>
      </ActiveArtistProvider>
    </>
  );
}
