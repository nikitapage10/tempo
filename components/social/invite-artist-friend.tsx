"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { requestArtistInvite } from "@/lib/api/artist-invite-requests";
import { errorMessage } from "@/lib/utils";

/** Ask TEMPO to invite someone who isn’t on the program yet as a full artist. */
export function InviteArtistFriend({ artistId }: { artistId?: string | null }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await requestArtistInvite({
        email: email.trim(),
        note: note.trim() || undefined,
        artistId: artistId || undefined,
      });
      toast("Asked TEMPO to invite them. You’ll hear once it’s approved.", "ok");
      setEmail("");
      setNote("");
      setOpen(false);
    } catch (err) {
      toast(errorMessage(err, "Couldn’t send that invite request."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-quiet space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-hi">Invite an artist friend</p>
          <p className="mt-1 text-xs leading-relaxed text-text-lo">
            They’re not on TEMPO yet? Send their email and we’ll ask the program to invite
            them. It needs approval during beta.
          </p>
        </div>
        {!open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <UserPlus className="size-3.5" />
            Invite
          </Button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-mono mb-1 block" htmlFor="artist-friend-email">
              Email
            </label>
            <Input
              id="artist-friend-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@studio.com"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label-mono mb-1 block" htmlFor="artist-friend-note">
              Note <span className="normal-case tracking-normal text-text-lo">(optional)</span>
            </label>
            <Input
              id="artist-friend-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How you know them, or why they should join"
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setEmail("");
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Request invite"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
