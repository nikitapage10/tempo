"use client";

import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveSpaceProvider>
      <AppShell>{children}</AppShell>
    </ActiveSpaceProvider>
  );
}
