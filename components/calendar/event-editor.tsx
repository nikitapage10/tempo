"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useCalendarCategoryPalette } from "@/components/calendar/calendar-category-provider";
import { useCalendarCommentMutation, useCalendarDiscussion, useCalendarEventMutations } from "@/hooks/use-calendar";
import {
  browserTimezone,
  dateInTimeZone,
  zonedLocalToUtc,
} from "@/lib/calendar/date";
import {
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventKind,
  type CalendarMilestoneStage,
  type CalendarRecurrence,
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
  existingEvents = [],
  defaultKind = "other",
  defaultTitle = "",
  defaultMilestoneStage = null,
  onClose,
}: {
  open: boolean;
  event: CalendarEvent | null;
  defaultDate: string;
  defaultSpaceId: string;
  spaces: Space[];
  relationOptions: CalendarRelationOption[];
  existingEvents?: CalendarEvent[];
  defaultKind?: CalendarEventKind;
  defaultTitle?: string;
  defaultMilestoneStage?: CalendarMilestoneStage | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const eventCategories = useCalendarCategoryPalette().filter(
    (category) => category.group === "event"
  );
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
  const [recurrence, setRecurrence] = React.useState<CalendarRecurrence>("none");
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [reminders, setReminders] = React.useState<number[]>([]);
  const [participants, setParticipants] = React.useState("");
  const [links, setLinks] = React.useState("");
  const [attachments, setAttachments] = React.useState("");
  const [milestoneStage, setMilestoneStage] = React.useState<CalendarMilestoneStage | "">("");
  const [dependencyEventId, setDependencyEventId] = React.useState("");
  const [completed, setCompleted] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const discussion = useCalendarDiscussion(event?.id ?? null);
  const commentMutation = useCalendarCommentMutation(event?.id ?? null);

  React.useEffect(() => {
    if (!open) return;
    const zone = event?.timezone || browserTimezone();
    setTitle(event?.title ?? defaultTitle);
    setKind(event?.kind ?? defaultKind);
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
    setRecurrence(event?.recurrence ?? "none");
    setRecurrenceUntil(event?.recurrence_until ?? "");
    setReminders(event?.reminder_minutes ?? []);
    setParticipants((event?.participants ?? []).join(", "));
    setLinks((event?.links ?? []).map((link) => `${link.label} | ${link.url}`).join("\n"));
    setAttachments((event?.attachment_urls ?? []).join("\n"));
    setMilestoneStage(event?.milestone_stage ?? defaultMilestoneStage ?? "");
    setDependencyEventId(event?.dependency_event_id ?? "");
    setCompleted(!!event?.completed_at);
    setConfirmDelete(false);
  }, [open, event, defaultDate, defaultSpaceId, defaultKind, defaultTitle, defaultMilestoneStage]);

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
    const planning = {
      recurrence,
      recurrence_until: recurrence === "none" ? null : recurrenceUntil || null,
      reminder_minutes: reminders,
      participants: participants.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 25),
      links: links.split("\n").map((line) => {
        const [label, ...url] = line.split("|");
        return { label: label?.trim() || "Link", url: url.join("|").trim() };
      }).filter((link) => /^https?:\/\//.test(link.url)),
      attachment_urls: attachments.split("\n").map((value) => value.trim()).filter((value) => /^https?:\/\//.test(value)).slice(0, 12),
      milestone_stage: kind === "milestone" ? milestoneStage || null : null,
      dependency_event_id: dependencyEventId || null,
      completed_at: completed ? event?.completed_at ?? new Date().toISOString() : null,
    };
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
          ...planning,
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
          ...planning,
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

  async function duplicate() {
    if (!event) return;
    try {
      await mutations.duplicate.mutateAsync({ event });
      toast("Event duplicated", "ok");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t duplicate the event.");
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
                {eventCategories.map((option) => (
                  <option key={option.key} value={option.key}>
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
          {kind === "milestone" ? (
            <div>
              <Label htmlFor="event-stage">Creative stage</Label>
              <select id="event-stage" value={milestoneStage} onChange={(e) => setMilestoneStage(e.target.value as CalendarMilestoneStage)} className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice">
                <option value="">No stage</option>
                {(["writing", "recording", "mixing", "mastering", "pitching", "release"] as const).map((stage) => <option key={stage} value={stage}>{stage[0].toUpperCase() + stage.slice(1)}</option>)}
              </select>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-recurrence">Repeat</Label>
              <select id="event-recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value as CalendarRecurrence)} className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice">
                <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </div>
            {recurrence !== "none" ? <div><Label htmlFor="event-repeat-until">Repeat until (optional)</Label><Input id="event-repeat-until" type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} className="mt-1" /></div> : null}
          </div>
          <fieldset>
            <legend className="text-xs font-medium text-text-lo">Reminders</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[[15, "15 min"], [60, "1 hour"], [1440, "1 day"], [10080, "1 week"]].map(([minutes, label]) => <label key={minutes} className="flex items-center gap-1.5 rounded-chip border border-line px-2 py-1 text-xs text-text-hi"><input type="checkbox" checked={reminders.includes(minutes as number)} onChange={() => setReminders((current) => current.includes(minutes as number) ? current.filter((value) => value !== minutes) : [...current, minutes as number])} className="accent-[var(--ice)]" />{label}</label>)}
            </div>
          </fieldset>
          <div><Label htmlFor="event-participants">Participants (comma separated)</Label><Input id="event-participants" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Name or email, Name or email" className="mt-1" /></div>
          <div><Label htmlFor="event-dependency">Depends on (optional)</Label><select id="event-dependency" value={dependencyEventId} onChange={(e) => setDependencyEventId(e.target.value)} className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"><option value="">No dependency</option>{existingEvents.filter((candidate) => candidate.id !== event?.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select></div>
          <div><Label htmlFor="event-links">Links (one per line: Label | https://…)</Label><Textarea id="event-links" value={links} onChange={(e) => setLinks(e.target.value)} rows={2} className="mt-1" /></div>
          <div><Label htmlFor="event-attachments">Attachments or briefs (one URL per line)</Label><Textarea id="event-attachments" value={attachments} onChange={(e) => setAttachments(e.target.value)} rows={2} className="mt-1" /></div>
          {event ? <label className="flex items-center gap-2 text-sm text-text-hi"><input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="size-4 accent-[var(--ice)]" />Mark complete</label> : null}
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
          {event ? (
            <section className="rounded-card border border-line bg-bg-2/35 p-3">
              <h3 className="label-mono text-text-lo">Conversation & activity</h3>
              <div className="mt-2 flex gap-2"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" /><Button type="button" size="sm" disabled={!comment.trim() || commentMutation.isPending} onClick={async () => { await commentMutation.mutateAsync(comment); setComment(""); }}>Post</Button></div>
              <div className="mt-3 max-h-36 space-y-2 overflow-y-auto text-xs">
                {(discussion.data?.comments ?? []).map((item) => <p key={item.id} className="rounded-input bg-bg-1 px-2 py-1.5 text-text-hi">{item.body}</p>)}
                {(discussion.data?.activity ?? []).slice(0, 5).map((item) => <p key={item.id} className="font-mono text-[10px] text-text-lo">{item.summary}</p>)}
              </div>
            </section>
          ) : null}
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
                  <span className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => void duplicate()} disabled={busy}>Duplicate</Button><Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button></span>
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
