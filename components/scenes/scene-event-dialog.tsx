"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSceneEventMutations } from "@/hooks/use-scene-events";
import { useToast } from "@/components/ui/toast";
import type { SceneEventKind } from "@/lib/types";

const KINDS: { value: SceneEventKind; label: string }[] = [
  { value: "session", label: "Session" },
  { value: "show", label: "Show" },
  { value: "listening", label: "Listening party" },
  { value: "meeting", label: "Meeting" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SceneEventDialog({
  open,
  onOpenChange,
  sceneId,
  myProfileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneId: string;
  myProfileId: string | null;
}) {
  const { toast } = useToast();
  const { create } = useSceneEventMutations(sceneId);
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<SceneEventKind>("other");
  const [startDate, setStartDate] = React.useState(todayIso());
  const [endDate, setEndDate] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [locationUrl, setLocationUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [capacity, setCapacity] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setKind("other");
    setStartDate(todayIso());
    setEndDate("");
    setLocation("");
    setLocationUrl("");
    setDescription("");
    setCapacity("");
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myProfileId || !title.trim() || !startDate) return;
    try {
      await create.mutateAsync({
        createdByProfileId: myProfileId,
        title,
        kind,
        startDate,
        endDate: endDate || null,
        location,
        locationUrl,
        description,
        capacity: capacity ? Number(capacity) : null,
      });
      toast("Event added.", "ok");
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add that event.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New event" onClose={() => onOpenChange(false)}>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's happening?"
            maxLength={160}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SceneEventKind)}
              className="h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Capacity (optional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono">Starts</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="label-mono">Ends (optional)</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                min={startDate}
              />
            </div>
          </div>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            maxLength={240}
          />
          <Input
            value={locationUrl}
            onChange={(e) => setLocationUrl(e.target.value)}
            placeholder="Link (optional — a call, a stream, a map)"
            type="url"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              Add event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
