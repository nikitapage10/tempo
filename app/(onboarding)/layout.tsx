"use client";

import { ActiveArtistProvider } from "@/components/active-artist-provider";
import { ArtistThemeProvider } from "@/components/artist-theme-provider";

/**
 * The onboarding shell.
 *
 * Only what ORIGIN genuinely needs: the active artist (to know whose Origin
 * this is) and the artist theme (so ice/amber match the artist's palette).
 * Everything else the authenticated shell normally mounts — AppShell, the
 * Lightfield driver, the global player, the boot intro — is deliberately absent.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveArtistProvider>
      <ArtistThemeProvider>{children}</ArtistThemeProvider>
    </ActiveArtistProvider>
  );
}
