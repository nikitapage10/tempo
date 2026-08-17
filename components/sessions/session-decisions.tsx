"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useSessionHistory, useSessionRoomMutations } from "@/hooks/use-session-rooms";

export function SessionDecisions({
  roomId,
  artistId,
  openMeetId,
}: {
  roomId: string;
  artistId: string;
  openMeetId: string | null;
}) {
  const { toast } = useToast();
  const { data } = useSessionHistory(roomId);
  const mutations = useSessionRoomMutations(artistId, roomId);
  const [body, setBody] = React.useState("");
  const decisions = data?.decisions ?? [];
  const meets = data?.meets ?? [];
  const meetTitle = (id: string) => {
    const meet = meets.find((item) => item.id === id);
    if (!meet) return "A hang";
    return new Date(meet.started_at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {openMeetId ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) return;
            void mutations.logDecision
              .mutateAsync(body.trim())
              .then(() => setBody(""))
              .catch((err) => toast(err instanceof Error ? err.message : "Couldn’t log that decision."));
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="We decided…"
          />
          <Button type="submit" size="sm" disabled={!body.trim()}>
            Log a decision
          </Button>
        </form>
      ) : (
        <p className="text-sm text-text-lo">Start a hang to pin a decision to this occasion.</p>
      )}
      {decisions.length === 0 ? (
        <p className="text-sm text-text-lo">No decisions yet.</p>
      ) : (
        <ul className="space-y-2">
          {decisions.map((decision) => (
            <li key={decision.id} className="well p-3">
              <p className="text-sm text-text-hi">{decision.body}</p>
              <p className="mt-1 font-data text-[11px] text-text-lo">{meetTitle(decision.session_meet_id)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
