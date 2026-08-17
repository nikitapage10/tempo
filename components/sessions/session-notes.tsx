"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useSessionRoomMutations } from "@/hooks/use-session-rooms";

export function SessionNotes({
  roomId,
  artistId,
  notes,
  editorLabel,
}: {
  roomId: string;
  artistId: string;
  notes: string;
  editorLabel?: string | null;
}) {
  const { toast } = useToast();
  const mutations = useSessionRoomMutations(artistId, roomId);
  const updateNotes = mutations.update.mutateAsync;
  const [value, setValue] = React.useState(notes);
  const [saved, setSaved] = React.useState(true);

  React.useEffect(() => {
    setValue(notes);
    setSaved(true);
  }, [notes]);

  React.useEffect(() => {
    if (value === notes) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      void updateNotes({ notes: value })
        .then(() => {
          setSaved(true);
          toast("Saved", "ok");
        })
        .catch((err) => {
          toast(err instanceof Error ? err.message : "Couldn’t save notes.");
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [notes, toast, updateNotes, value]);

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={12}
        placeholder="Shared notes for this Session. Last save wins if two people type at once."
      />
      <p className="text-xs text-text-lo">
        {saved ? "Saved." : "Saving…"} The last save wins.
        {editorLabel ? ` ${editorLabel} is also looking at these notes.` : ""}
      </p>
    </div>
  );
}
