"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function ShareLinkDialog({
  open,
  onOpenChange,
  roomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
}) {
  const { toast } = useToast();
  const [passcode, setPasscode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<{ url: string; passcode: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setPasscode("");
      setCreated(null);
    }
  }, [open]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (passcode.trim().length < 6) {
      toast("Use at least 6 characters for the passcode.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/sessions/${roomId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Couldn’t create that link.");
      }
      setCreated({
        url: String(body.url ?? ""),
        passcode: String(body.passcode ?? passcode.trim()),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t create that link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Share a guest link"
        description="People without a TEMPO account can join this room. They never see your catalog."
        onClose={() => onOpenChange(false)}
      >
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-text-lo">Shown once. Copy both now.</p>
            <div>
              <Label>Link</Label>
              <Input readOnly value={created.url} onFocus={(event) => event.currentTarget.select()} />
            </div>
            <div>
              <Label>Passcode</Label>
              <Input readOnly value={created.passcode} onFocus={(event) => event.currentTarget.select()} />
            </div>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <div>
              <Label htmlFor="session-passcode">Passcode</Label>
              <Input
                id="session-passcode"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="At least 6 characters"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create link"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
