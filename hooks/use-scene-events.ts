"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelSceneEvent,
  clearEventRsvp,
  createSceneEvent,
  fetchEventRsvpRoster,
  fetchSceneEvents,
  setEventRsvp,
} from "@/lib/api/scene-events";
import type { SceneEvent, SceneRsvpResponse } from "@/lib/types";

export function useSceneEvents(sceneId: string | null, myProfileId: string | null) {
  return useQuery({
    queryKey: ["scene-events", sceneId],
    queryFn: () => fetchSceneEvents(sceneId!, myProfileId),
    enabled: !!sceneId,
    staleTime: 15_000,
  });
}

export function useEventRsvpRoster(eventId: string | null) {
  return useQuery({
    queryKey: ["scene-event-rsvps", eventId],
    queryFn: () => fetchEventRsvpRoster(eventId!),
    enabled: !!eventId,
  });
}

export function useSceneEventMutations(sceneId: string | null) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["scene-events", sceneId] });
  }

  const create = useMutation({
    mutationFn: (input: Omit<Parameters<typeof createSceneEvent>[0], "sceneId">) =>
      createSceneEvent({ sceneId: sceneId!, ...input }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (eventId: string) => cancelSceneEvent(eventId),
    onSuccess: invalidate,
  });

  const rsvp = useMutation({
    mutationFn: ({
      eventId,
      profileId,
      response,
      note,
    }: {
      eventId: string;
      profileId: string;
      response: SceneRsvpResponse;
      note?: string | null;
    }) => setEventRsvp({ eventId, sceneId: sceneId!, profileId, response, note }),
    onMutate: ({ eventId, response }) => {
      qc.setQueryData(["scene-events", sceneId], (old: unknown) =>
        Array.isArray(old)
          ? old.map((e: SceneEvent) =>
              e.id === eventId
                ? {
                    ...e,
                    my_response: response,
                    going_count:
                      e.going_count +
                      (response === "going" && e.my_response !== "going" ? 1 : 0) -
                      (e.my_response === "going" && response !== "going" ? 1 : 0),
                    interested_count:
                      e.interested_count +
                      (response === "interested" && e.my_response !== "interested" ? 1 : 0) -
                      (e.my_response === "interested" && response !== "interested" ? 1 : 0),
                  }
                : e
            )
          : old
      );
    },
    onSettled: invalidate,
  });

  const clearRsvp = useMutation({
    mutationFn: ({ eventId, profileId }: { eventId: string; profileId: string }) =>
      clearEventRsvp(eventId, profileId),
    onSuccess: invalidate,
  });

  return { create, cancel, rsvp, clearRsvp };
}
