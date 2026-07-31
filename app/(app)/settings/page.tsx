"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArtistsManager } from "@/components/artists/artists-manager";
import { SpacesManager } from "@/components/spaces/spaces-manager";
import { Button } from "@/components/ui/button";
import { SupportReportDialog } from "@/components/support/support-report-dialog";

export default function SettingsPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
          Settings
        </h1>
        <p className="mt-2 text-text-lo">
          Manage artists, spaces and your account. Stage editing lives on the
          board.
        </p>
      </div>

      <ArtistsManager />

      <SpacesManager />

      <section className="rounded-card border border-line bg-bg-1 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Artist Origin
        </p>
        <p className="mt-2 text-sm text-text-hi">
          The story TEMPO drafted from your introduction — your promise, your
          compass, and the chapter you&rsquo;re in. Revisit or rewrite it any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            {/* Opens straight into the editable story, no film. */}
            <Link href="/origin?revisit=1">Open Artist Origin</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/origin?replay=1">Replay introduction</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Import
        </p>
        <p className="mt-2 text-sm text-text-hi">
          Drop in a spreadsheet, screenshots, or a voice note and TEMPO will
          propose what to add. Nothing changes until you approve it.
        </p>
        <Button variant="secondary" className="mt-4" asChild>
          <Link href="/import">Import more music</Link>
        </Button>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Help &amp; support
        </p>
        <p className="mt-2 text-sm text-text-hi">
          Report a bug, ask for help, or share feedback with the TEMPO operator.
        </p>
        <div className="mt-3"><SupportReportDialog compact /></div>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Account
        </p>
        <p className="mt-2 text-sm text-text-hi">
          Sign out of TEMPO on this device.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </section>
    </div>
  );
}
