"use client";

import { ActiveArtistProvider } from "@/components/active-artist-provider";
import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";
import { ArtistThemeProvider } from "@/components/artist-theme-provider";
import { LightfieldDriver } from "@/components/lightfield-driver";
import { IntroPreflight } from "@/components/intro-preflight";
import { GlobalPlayerProvider } from "@/components/player/global-player-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
