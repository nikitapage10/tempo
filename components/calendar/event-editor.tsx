"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useCalendarEventMutations } from "@/hooks/use-calendar";
import {
  browserTimezone,
  dateInTimeZone,
  zonedLocalToUtc,
} from "@/lib/calendar/date";
import {
  CALENDAR_EVENT_KINDS,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventKind,
  type CalendarRelationOption,
} from "@/lib/calendar/types";
import type { Space } from "@/lib/types";

function timeInput(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function CalendarEventEditor({
  open,
  event,
  defaultDate,
  defaultSpaceId,
  spaces,
  relationOptions,
  onClose,
}: {
  open: boolean;
  event: CalendarEvent | null;
  defaultDate: string;
  defaultSpaceId: string;
  spaces: Space[];
  relationOptions: CalendarRelationOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const mutations = useCalendarEventMutations();
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<CalendarEventKind>("other");
  const [spaceId, setSpaceId] = React.useState(defaultSpaceId);
  const [allDay, setAllDay] = React.useState(true);
  const [startDate, setStartDate] = React.useState(defaultDate);
  const [endDate, setEndDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("");
  const [timezone, setTimezone] = React.useState(browserTimezone());
  const [relation, setRelation] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const zone = event?.timezone || browserTimezone();
    setTitle(event?.title ?? "");
    setKind(event?.kind ?? "other");
    setSpaceId(event?.space_id ?? defaultSpaceId);
    setAllDay(event?.all_day ?? true);
    setTimezone(zone);
    setStartDate(
      event?.all_day
        ? event.start_date ?? defaultDate
        : event?.starts_at
          ? dateInTimeZone(event.starts_at, zone)
          : defaultDate
    );
    setEndDate(
      event?.all_day
        ? event.end_date ?? ""
        : event?.ends_at
          ? dateInTimeZone(event.ends_at, zone)
          : ""
    );
    setStartTime(
      !event?.all_day && event?.starts_at
        ? timeInput(event.starts_at, zone)
        : "09:00"
    );
    setEndTime(
      !event?.all_day && event?.ends_at ? timeInput(event.ends_at, zone) : ""
    );
    setRelation(
      event?.track_id
        ? `track:${event.track_id}`
        : event?.project_id
          ? `project:${event.project_id}`
          : ""
    );
    setLocation(event?.location ?? "");
    setDescription(event?.description ?? "");
    setConfirmDelete(false);
  }, [open, event, defaultDate, defaultSpaceId]);

  const options = relationOptions.filter((option) => option.spaceId === spaceId);
  const busy =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.remove.isPending;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !spaceId || !startDate) return;
    const [relationType, relationId] = relation.split(":");
    let input: CalendarEventInput;
    try {
      if (allDay) {
        if (endDate && endDate < startDate) {
          toast("End date can’t be before the start date.");
          return;
        }
        input = {
          space_id: spaceId,
          track_id: relationType === "track" ? relationId : null,
          project_id: relationType === "project" ? relationId : null,
          title,
          kind,
          description,
          location,
          all_day: true,
          start_date: startDate,
          end_date: endDate || null,
          starts_at: null,
          ends_at: null,
          timezone: null,
        };
      } else {
        const startsAt = zonedLocalToUtc(startDate, startTime || "09:00", timezone);
        const endsAt = endTime
          ? zonedLocalToUtc(endDate || startDate, endTime, timezone)
          : null;
        if (endsAt && endsAt <= startsAt) {
          toast("End time must be after the start time.");
          return;
        }
        input = {
          space_id: spaceId,
          track_id: relationType === "track" ? relationId : null,
          project_id: relationType === "project" ? relationId : null,
          title,
          kind,
          description,
          location,
          all_day: false,
          start_date: null,
          end_date: null,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone,
        };
      }
      if (event) {
        await mutations.update.mutateAsync({ id: event.id, input });
        toast("Event updated", "ok");
      } else {
        await mutations.create.mutateAsync(input);
        toast("Event created", "ok");
      }
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t save the event.");
    }
  }

  async function remove() {
    if (!event) return;
    try {
      await mutations.remove.mutateAsync(event.id);
      toast("Event deleted", "ok");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t delete the event.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title={event ? "Edit event" : "New event"}
        description="Schedule work that doesn’t already have a TEMPO date."
        onClose={onClose}
        className="max-h-[92vh]"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              autoFocus
              required
              className="mt-1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-kind">Kind</Label>
              <select
                id="event-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as CalendarEventKind)}
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {CALENDAR_EVENT_KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="event-space">Space</Label>
              <select
                id="event-space"
                value={spaceId}
                onChange={(e) => {
                  setSpaceId(e.target.value);
                  setRelation("");
                }}
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-hi">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="size-4 accent-[var(--ice)]"
            />
            All day
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-start-date">Start date</Label>
              <Input
                id="event-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            {!allDay ? (
              <div>
                <Label htmlFor="event-start-time">Start time</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="event-end-date">End date (optional)</Label>
              <Input
                id="event-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            {!allDay ? (
              <div>
                <Label htmlFor="event-end-time">End time (optional)</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>
          {!allDay ? (
            <div>
              <Label htmlFor="event-timezone">Timezone</Label>
              <Input
                id="event-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="event-relation">Related to (optional)</Label>
            <select
              id="event-relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <option value="">No related item</option>
              {options.map((option) => (
                <option
                  key={`${option.type}:${option.id}`}
                  value={`${option.type}:${option.id}`}
                >
                  {option.type === "track" ? "Track" : "Project"} · {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={240}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div>
              {event ? (
                confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void remove()}
                      disabled={busy}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                )
              ) : null}
            </div>
            <span className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim() || !spaceId}>
                {event ? "Save changes" : "Create event"}
              </Button>
            </span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

