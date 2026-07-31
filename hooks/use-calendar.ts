"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCalendarData } from "@/lib/api/calendar";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/api/calendar-events";
import type { CalendarEventInput } from "@/lib/calendar/types";

export function useCalendarData(input: {
  artistId: string | null;
  spaceIds: string[];
  spaceLabels: Record<string, string>;
  rangeStart: string;
  rangeEndExclusive: string;
  today: string;
}) {
  return useQuery({
    queryKey: [
      "calendar",
      input.artistId,
      input.spaceIds.join(","),
      input.rangeStart,
      input.rangeEndExclusive,
      input.today,
    ],
    queryFn: () => fetchCalendarData(input),
    enabled: !!input.artistId && input.spaceIds.length > 0,
  });
}

export function useCalendarEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar"] });

  const create = useMutation({
    mutationFn: (input: CalendarEventInput) => createCalendarEvent(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CalendarEventInput }) =>
      updateCalendarEvent(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

