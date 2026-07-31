"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCalendarData } from "@/lib/api/calendar";
import {
  createCalendarEvent,
  addCalendarComment,
  deleteCalendarEvent,
  duplicateCalendarEvent,
  fetchCalendarDiscussion,
  rescheduleCalendarItem,
  scheduleUnscheduledItem,
  updateCalendarEvent,
} from "@/lib/api/calendar-events";
import type { CalendarEvent, CalendarEventInput, CalendarItem, UnscheduledCalendarItem } from "@/lib/calendar/types";

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
  const reschedule = useMutation({
    mutationFn: ({ item, date, cascadeDependencies = false }: { item: CalendarItem; date: string; cascadeDependencies?: boolean }) =>
      rescheduleCalendarItem(item, date, cascadeDependencies),
    onSuccess: invalidate,
  });
  const schedule = useMutation({
    mutationFn: ({ item, date }: { item: UnscheduledCalendarItem; date: string }) =>
      scheduleUnscheduledItem(item, date),
    onSuccess: invalidate,
  });
  const duplicate = useMutation({
    mutationFn: ({ event, date }: { event: CalendarEvent; date?: string }) =>
      duplicateCalendarEvent(event, date),
    onSuccess: invalidate,
  });

  return { create, update, remove, reschedule, schedule, duplicate };
}

export function useCalendarDiscussion(eventId: string | null) {
  return useQuery({
    queryKey: ["calendar-discussion", eventId],
    queryFn: () => fetchCalendarDiscussion(eventId!),
    enabled: !!eventId,
  });
}

export function useCalendarCommentMutation(eventId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addCalendarComment(eventId!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-discussion", eventId] }),
  });
}
