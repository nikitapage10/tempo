"use client";

import { ActiveSpaceProvider } from "@/components/active-space-provider";
import { AppShell } from "@/components/app-shell";
import { LightfieldDriver } from "@/components/lightfield-driver";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveSpaceProvider>
      <LightfieldDriver />
      <AppShell>{children}</AppShell>
    </ActiveSpaceProvider>
  );
}
