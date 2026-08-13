import { redirect } from "next/navigation";
import { ActiveArtistProvider } from "@/components/active-artist-provider";
import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";
import { ArtistThemeProvider } from "@/components/artist-theme-provider";
import { LightfieldDriver } from "@/components/lightfield-driver";
import { IntroPreflight } from "@/components/intro-preflight";
import { GlobalPlayerProvider } from "@/components/player/global-player-provider";
import { shouldSendToOrigin, type OriginOwnedRow } from "@/lib/auth/origin-gate";
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

  let ownedArtists: OriginOwnedRow[] | null = null;
  let ownedError: { message?: string } | null = null;
  if (user) {
    const first = await supabase
      .from("artists")
      .select("id, origin_status, workspace_kind")
      .eq("user_id", user.id)
      .order("sort", { ascending: true });
    if (first.error && /workspace_kind/i.test(first.error.message)) {
      const retry = await supabase
        .from("artists")
        .select("id, origin_status")
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

  // Origin is for *music* artists the signed-in person owns. A leftover
  // team-only Artist row must not trap a manager; a later artist invite
  // (personal home + unfinished music, or a newly minted artist) must.
  if (
    !ownedError &&
    shouldSendToOrigin({
      owned: ownedArtists ?? [],
      hasMembership: !!membership,
    })
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
