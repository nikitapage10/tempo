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
  const { data: firstArtist, error } = await supabase
    .from("artists")
    .select("origin_status")
    .order("sort", { ascending: true })
    .limit(1)
    .maybeSingle();

  // The workspace is downstream of Origin. A new account with no artist yet
  // is sent there so its provider can create the default artist. An unfinished
  // first artist is redirected before AppShell ever mounts. If migration 042
  // is missing, the query errors and the legacy app remains reachable rather
  // than trapping the account in an onboarding flow that cannot save.
  if (
    !error &&
    (!firstArtist ||
      firstArtist.origin_status === "not_started" ||
      firstArtist.origin_status === "in_progress")
  ) {
    redirect("/origin");
  }

  // Artist resolves first — spaces bootstrap against the active artist.
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
