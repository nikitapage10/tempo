"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/ui/signed-image";
import { useToast } from "@/components/ui/toast";
import { useProjects } from "@/hooks/use-projects";
import { useTracks } from "@/hooks/use-tracks";
import { useSessionPins, useSessionRoomMutations } from "@/hooks/use-session-rooms";
import { canRead, type AreaGrants } from "@/lib/team/areas";
import { cn } from "@/lib/utils";

export function SessionPins({
  roomId,
  artistId,
  spaceId,
  areas,
  readOnly = false,
}: {
  roomId: string;
  artistId: string;
  spaceId: string;
  areas: AreaGrants;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const { data: pins = [] } = useSessionPins(roomId);
  const mutations = useSessionRoomMutations(artistId, roomId);
  const tracks = useTracks(canRead(areas, "catalog") ? spaceId : null);
  const projects = useProjects(canRead(areas, "catalog") ? spaceId : null);
  const [trackId, setTrackId] = React.useState("");
  const catalog = canRead(areas, "catalog");

  return (
    <div className="space-y-3">
      {!readOnly && catalog ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trackId) return;
            void mutations.addPin
              .mutateAsync({ trackId })
              .then(() => setTrackId(""))
              .catch((err) => toast(err instanceof Error ? err.message : "Couldn’t pin that."));
          }}
        >
          <select
            className="h-9 flex-1 rounded-input border border-line bg-bg-2 px-2 text-sm"
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
          >
            <option value="">Pin a track…</option>
            {(tracks.data ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={!trackId}>
            Pin
          </Button>
        </form>
      ) : null}
      {pins.length === 0 ? (
        <p className="text-sm text-text-lo">Nothing on the rack yet. Pin the references you keep coming back to.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pins.map((pin) => {
            const href = pin.track_id && catalog ? `/track/${pin.track_id}` : pin.project_id && catalog ? `/projects/${pin.project_id}` : null;
            const inner = (
              <div className="well flex items-center gap-3 p-2">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-input bg-bg-2">
                  <SignedImage path={pin.artwork_path} className="absolute inset-0 size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-hi">{pin.title}</p>
                  {pin.note ? <p className="truncate text-xs text-text-lo">{pin.note}</p> : null}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-xs text-text-lo hover:text-warn"
                    onClick={() => void mutations.deletePin.mutateAsync(pin.id)}
                  >
                    Unpin
                  </button>
                ) : null}
              </div>
            );
            return (
              <li key={pin.id} className={cn(!href && "pointer-events-none")}>
                {href ? <Link href={href}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
      {!catalog && pins.length > 0 ? (
        <p className="text-xs text-text-lo">Titles only. This workspace does not include catalog access.</p>
      ) : null}
    </div>
  );
}
