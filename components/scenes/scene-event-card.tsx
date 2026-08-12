"use client";

import * as React from "react";
import { Ban, MapPin, Users } from "lucide-react";
import { RsvpControl } from "@/components/scenes/rsvp-control";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSceneEventMutations } from "@/hooks/use-scene-events";
import type { SceneEvent } from "@/lib/types";

const KIND_LABEL: Record<SceneEvent["kind"], string> = {
  session: "Session",
  show: "Show",
  listening: "Listening",
  meeting: "Meeting",
  workshop: "Workshop",
  other: "Event",
};

function formatDateRange(event: SceneEvent): string {
  if (!event.start_date) return "";
  const start = new Date(`${event.start_date}T00:00:00`);
  const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (!event.end_date || event.end_date === event.start_date) return startStr;
  const end = new Date(`${event.end_date}T00:00:00`);
  return `${startStr} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function SceneEventCard({
  event,
  sceneId,
  myProfileId,
  isManager,
}: {
  event: SceneEvent;
  sceneId: string;
  myProfileId: string | null;
  isManager: boolean;
}) {
  const { rsvp, cancel } = useSceneEventMutations(sceneId);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const full =
    !!event.capacity && event.going_count >= event.capacity && event.my_response !== "going";
  const day = event.start_date ? new Date(`${event.start_date}T00:00:00`).getDate() : "";
  const month = event.start_date
    ? new Date(`${event.start_date}T00:00:00`).toLocaleDateString(undefined, { month: "short" })
    : "";

  return (
    <div className="panel-quiet flex gap-4 p-4">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-input border border-line bg-bg-2 py-2 text-center">
        <span className="label-mono text-ice">{month}</span>
        <span className="text-xl font-semibold tabular-nums text-text-hi">{day}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-hi">{event.title}</p>
            <p className="text-xs text-text-lo">
              {KIND_LABEL[event.kind]} · {formatDateRange(event)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
          {isManager ? (
            <button
              type="button"
              title="Cancel event"
              onClick={() => setConfirmCancel(true)}
              className="shrink-0 rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-warn"
            >
              <Ban className="size-3.5" />
            </button>
          ) : null}
        </div>
        {event.description ? (
          <p className="whitespace-pre-wrap text-sm text-text-lo">{event.description}</p>
        ) : null}
        {event.location_url ? (
          <a
            href={event.location_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-ice hover:underline"
          >
            <MapPin className="size-3" />
            {event.location_url}
          </a>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-text-lo">
            <Users className="size-3" />
            {event.going_count} going
            {event.capacity ? ` / ${event.capacity}` : ""}
            {event.interested_count ? ` · ${event.interested_count} interested` : ""}
          </span>
        </div>
        {myProfileId ? (
          <RsvpControl
            value={event.my_response}
            full={full}
            onChange={(response) =>
              rsvp.mutate({ eventId: event.id, profileId: myProfileId, response })
            }
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel ${event.title}?`}
        description="Everyone who RSVP'd will no longer see it on the Events tab."
        confirmLabel="Cancel event"
        busy={cancel.isPending}
        onConfirm={async () => {
          await cancel.mutateAsync(event.id);
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}
