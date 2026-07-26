"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    <div className="max-w-lg">
      <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
        Settings
      </h1>
      <p className="mt-2 text-text-lo">
        Spaces, stages, and templates will live here. For now — account.
      </p>

      <section className="mt-8 rounded-card border border-line bg-bg-1 p-5">
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
