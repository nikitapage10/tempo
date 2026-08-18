"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { useActiveTeamRoster } from "@/hooks/use-artist-members";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSessionRoomMutations } from "@/hooks/use-session-rooms";
import { useTracks } from "@/hooks/use-tracks";
import { fetchMemberProfiles } from "@/lib/api/member-profile";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";

export function CreateSessionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { spaces, activeSpaceId } = useActiveSpace();
  const currentUser = useCurrentUser();
  const { create } = useSessionRoomMutations(activeArtist?.id ?? null);
  const roster = useActiveTeamRoster(open ? activeArtist?.id ?? null : null);

  const [title, setTitle] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [spaceId, setSpaceId] = React.useState(activeSpaceId ?? "");
  const [trackId, setTrackId] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const tracks = useTracks(open ? spaceId || null : null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setPurpose("");
      setSpaceId(activeSpaceId ?? spaces[0]?.id ?? "");
      setTrackId("");
      setSelected(new Set());
    }
  }, [activeSpaceId, open, spaces]);

  const memberIds = React.useMemo(
    () => (roster.data ?? []).map((member) => member.userId).filter((id): id is string => Boolean(id)),
    [roster.data]
  );
  const profiles = useQuery({
    queryKey: ["session-create-profiles", memberIds.slice().sort()],
    queryFn: () => fetchMemberProfiles(memberIds),
    enabled: open && memberIds.length > 0,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeArtist || !spaceId || !title.trim()) return;
    try {
      const id = await create.mutateAsync({
        artistId: activeArtist.id,
        spaceId,
        title: title.trim(),
        purpose: purpose.trim(),
        trackId: trackId || null,
        memberUserIds: Array.from(selected).filter((id) => id !== currentUser?.id),
      });
      onOpenChange(false);
      router.push(`/sessions/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t start that Session.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New session" description="A room you can keep coming back to." onClose={() => onOpenChange(false)}>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <Label htmlFor="session-title">Name</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Thursday writing room"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="session-purpose">What is this for?</Label>
            <Textarea
              id="session-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Finish the chorus, divvy the parts, leave with next steps."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="session-space">Space</Label>
            <select
              id="session-space"
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={spaceId}
              onChange={(event) => setSpaceId(event.target.value)}
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="session-song">Song (optional)</Label>
            <select
              id="session-song"
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={trackId}
              onChange={(event) => setTrackId(event.target.value)}
            >
              <option value="">No song yet</option>
              {(tracks.data ?? []).map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </select>
          </div>
          {memberIds.length > 0 ? (
            <div>
              <Label>People</Label>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-input border border-line bg-bg-2/50 p-2">
                {memberIds.map((id) => {
                  const label = profiles.data?.get(id)?.displayName || "Teammate";
                  const checked = selected.has(id);
                  return (
                    <li key={id}>
                      <label className="flex items-center gap-2 rounded-input px-1.5 py-1 text-sm text-text-hi hover:bg-bg-1">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[var(--ice)]"
                          checked={checked}
                          onChange={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            });
                          }}
                        />
                        {label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? "Creating…" : "Create session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
