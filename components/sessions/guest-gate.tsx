"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/wordmark";
import { joinGuestSession } from "@/lib/api/session-guest";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";

export function GuestGate({
  token,
  title,
  onJoined,
}: {
  token: string;
  title: string;
  onJoined: () => void;
}) {
  const [name, setName] = React.useState("");
  const [passcode, setPasscode] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await joinGuestSession({
        token,
        passcode,
        displayName: name,
        website: honeypot,
      });
      onJoined();
    } catch {
      setError(SESSION_GUEST_UNAVAILABLE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg-0 px-4">
      <Wordmark className="mb-8" />
      <form className="panel-quiet w-full max-w-sm space-y-4 p-5" onSubmit={(event) => void handleJoin(event)}>
        <h1 className="font-display text-xl font-semibold text-text-hi">{title}</h1>
        <p className="text-sm text-text-lo">Enter a display name and the passcode to walk in.</p>
        <div>
          <Label htmlFor="guest-name">Display name</Label>
          <Input id="guest-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="guest-passcode">Passcode</Label>
          <Input
            id="guest-passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            required
          />
        </div>
        <div className="hidden" aria-hidden>
          <Label htmlFor="guest-website">Website</Label>
          <Input id="guest-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
        </div>
        {error ? <p className="text-sm text-warn">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || !name.trim() || !passcode}>
          {busy ? "Joining…" : "Join"}
        </Button>
      </form>
    </div>
  );
}
