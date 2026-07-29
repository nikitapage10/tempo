"use client";

import { ActiveArtistProvider } from "@/components/active-artist-provider";
import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";
import { ArtistThemeProvider } from "@/components/artist-theme-provider";
import { LightfieldDriver } from "@/components/lightfield-driver";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Artist resolves first — spaces bootstrap against the active artist.
  return (
    <ActiveArtistProvider>
      <ArtistThemeProvider>
        <ActiveSpaceProvider>
          <LightfieldDriver />
          <AppShell>{children}</AppShell>
        </ActiveSpaceProvider>
      </ArtistThemeProvider>
    </ActiveArtistProvider>
  );
}
