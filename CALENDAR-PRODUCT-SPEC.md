# TEMPO — Calendar Product Specification

*Status: Implemented (v0.59.0). Custom-event writes require migration 037; derived TEMPO dates remain readable before it is applied.*

**Related:** `CALENDAR-UX-SPEC.md` · `CALENDAR-TECHNICAL-DESIGN.md` · `PRODUCT.md` · `DESIGN-SYSTEM-V2.md` · `SECURITY-AND-PERMISSIONS.md`

---

## 1. Product statement

Calendar is TEMPO's creative schedule of record: one place to see what is due, what is releasing, and what is deliberately scheduled across the active artist's work.

It is not a general-purpose meeting calendar. It brings existing TEMPO dates together without copying them, then adds lightweight custom events for studio sessions, meetings, content, shows, and other work that does not already have a date-bearing TEMPO record.

### User problem

Dates currently live in several contexts: task due dates, track targets, next moves, project deadlines, and release planning. An artist can understand one track or project in isolation but cannot easily answer:

- What is coming up across this space?
- Where are deadlines colliding?
- What needs attention today or is already overdue?
- When did I intend to work, meet, publish, or perform?
- Which TEMPO record owns a date, and where should I change it?

### Product promise

Calendar provides one readable schedule while preserving one authoritative source for every date.

---

## 2. Goals and success criteria

### Goals

1. Collect actionable TEMPO dates into Month and Agenda views.
2. Make urgency legible without turning the page into an alarm dashboard.
3. Let an owner create simple all-day or timed custom events.
4. Preserve source-of-truth editing for tasks, tracks, projects, and releases.
5. Feel native to TEMPO's dark studio interface and lightfield interaction language.
6. Work clearly from 320px mobile layouts through wide desktop screens.

### Product success criteria

- A user can identify today's, upcoming, and overdue work without visiting several pages.
- Every derived item opens the correct authoritative editor.
- Moving a source date changes the Calendar result on the next successful refresh; no synchronization job is required.
- A custom event can be created with only a title and start date/time.
- Active-space and All-spaces results never cross the active artist boundary.
- Month remains scannable when several source types share a date.
- Source type and urgency are understandable without relying on color.

### Suggested post-launch measures

- Calendar visits per active user and return rate within seven days.
- Percentage of Calendar visits that open a source item or create an event.
- Custom-event creation and successful-save rate.
- Empty-state rate and query/error rate.
- Qualitative feedback on whether upcoming work is easier to understand.

No productivity score, streak, or opaque prioritization metric should be introduced.

---

## 3. Scope and terminology

### Calendar item

Any dated item rendered by Calendar. A calendar item is either:

- **Derived item:** a view of a date owned by an existing TEMPO record.
- **Custom event:** a row owned by Calendar and editable in Calendar.

### Calendar scope

- **Active space** is the default and follows the space switcher.
- **All spaces** includes every eligible space belonging to the active artist.
- Switching artists resets Calendar to that artist's active space.
- Custom events always belong to exactly one space, even when created from All spaces.

### Views

- **Month:** visual planning across a standard month grid, including leading and trailing days.
- **Agenda:** chronological, detail-forward groups for overdue, today, and upcoming work.

Desktop opens Month by default. Mobile opens Agenda by default. A user's explicit view choice may be remembered locally per device.

---

## 4. Sources included in v1

| Source | Inclusion rule | Calendar label | Authoritative destination |
|---|---|---|---|
| Task due date | `due_date` exists; completed hidden by default | Task title | Task editor |
| Track deadline | `deadline` exists | Track title · Target | Track workflow editor |
| Track next-action due | `next_action_due` exists | Next move text, or “Next move” | Track workflow editor |
| Project deadline | Project is active and `deadline` exists | Project name · Deadline | Project editor |
| Release date | Release project has `release_date` | Project name · Release | Release workspace |
| Pitching deadline | Release project has `pitching_deadline` | Project name · Pitching | Release workspace |
| Custom event | Calendar event intersects the visible range | Event title | Calendar event editor |

Additional rules:

- Completed tasks appear only when **Show completed** is enabled and are visually muted.
- Parked tracks are not silently removed; an explicit source filter controls track dates.
- Historical release dates remain visible when the user browses their month.
- A project deadline and release date on the same day remain separate if both fields exist; they express different commitments.
- Pinned version milestones are excluded. Their timestamps describe completed activity, not scheduled work.
- Sessions already logged are excluded for the same reason. A future retrospective overlay may add them separately.

---

## 5. Primary flows

### 5.1 Review the active-space schedule

1. Open Calendar from the app navigation.
2. Land on Month on desktop or Agenda on mobile.
3. See the current period, active space, source filters, and New event action.
4. Identify overdue, today, and upcoming items through labels, icons, order, and restrained state color.
5. Move between periods or return to Today.

### 5.2 Inspect a dense day

1. A month cell shows up to three compact items.
2. If more exist, select **+N more**.
3. Open the day agenda with every item in chronological/source order.
4. Select an item to open its source or Calendar editor.

### 5.3 Edit a derived item

1. Select a derived task, track, project, release, or pitching item.
2. Calendar navigates to the authoritative page and opens/focuses the relevant editor.
3. Save there using the existing mutation and validation path.
4. Returning to Calendar shows the new date after cache invalidation/refetch.

Calendar never writes a derived date through a copied `calendar_events` row.

### 5.4 Create a custom event

1. Select **New event** or an empty day.
2. Enter a required title and start.
3. Choose all-day or timed; add an optional end, kind, description, location, and related track or project.
4. When creating from All spaces, choose a required destination space.
5. Save and see the event in the current Calendar scope.

### 5.5 Change scope or filters

1. Switch between Active space and All spaces.
2. Filter Tasks, Track dates, Projects, Releases, or Events.
3. Optionally show completed tasks.
4. Empty filter results explain that items are hidden and offer **Clear filters**.

---

## 6. Custom events

### Kinds

`studio_session` · `meeting` · `content` · `live_show` · `personal` · `other`

The kind provides a short label/icon and secondary organization. It does not change permissions, reminders, or recurrence behavior.

### Fields

| Field | Requirement |
|---|---|
| Title | Required; trimmed; 1–160 characters |
| Space | Required; must belong to the active artist |
| Kind | Required; defaults to `other` |
| All day | Required boolean; defaults on when opened from a month date |
| Start | Required local date or timestamp |
| End | Optional; cannot precede start |
| Timezone | Required for timed events; defaults to the browser's IANA timezone |
| Description | Optional; plain text; up to 4,000 characters |
| Location | Optional; plain text; up to 240 characters |
| Related item | Optional; one track or one project in the same space |

All-day end dates are inclusive in the product UI. Timed timestamps are stored in UTC and displayed in the event timezone.

### Editing and deletion

- Owners may create, edit, and delete their custom events.
- Delete requires confirmation and is recoverable only through database backup; the UI must say this plainly.
- No drag-to-reschedule in v1. Dates change through the explicit editor.
- No automatic event is created when a task, track, project, or release date is added.

---

## 7. Urgency and ordering

Urgency is explainable and date-based:

- **Overdue:** date is before today and the source is not complete.
- **Today:** item intersects the user's current local date.
- **Upcoming:** future item in the loaded range.
- **Completed:** completed task shown by explicit filter.
- **Blocked:** a track-derived item whose track has `blocked_reason`; overdue takes precedence when both apply.

Month items sort within a day by:

1. Timed events by local start time.
2. Release and pitching dates.
3. Tasks.
4. Track next moves and deadlines.
5. Project deadlines.
6. Other all-day custom events.
7. Title as a deterministic final tie-breaker.

Agenda uses the same deterministic order after grouping Overdue, Today, and date.

Calendar does not infer importance from project size, follower activity, or opaque AI scoring.

---

## 8. Permissions and privacy

- Calendar is authenticated and follows existing Supabase Auth and RLS boundaries.
- Owners can read their derived catalog dates and CRUD their custom events.
- Custom-event v1 is owner-only. Track collaborators receive no new catalog, project, task, space, or event enumeration rights.
- All-spaces queries are constrained to spaces belonging to the active artist and current user.
- A related track/project must be owned by the user and belong to the chosen space.
- Guests and public profiles cannot access Calendar.
- UI filtering is convenience only; RLS remains authoritative.

---

## 9. Empty, loading, and error behavior

- **No items:** a quiet TEMPO empty state says the period is clear and offers New event.
- **Filters hide all items:** explain the filter state and offer Clear filters.
- **No spaces:** route the user toward space setup; event creation remains disabled.
- **Loading:** skeletons match the toolbar, month/agenda surface, and supporting rail—never a stack of generic cards.
- **Partial source failure:** show available source groups plus a restrained warning naming the unavailable group and Retry.
- **Event save failure:** keep all entered values, keep the editor open, and show a calm actionable error.
- **Source removed:** the item disappears on refresh; custom-event relations use `ON DELETE SET NULL`, so the event remains standalone.

---

## 10. V1 non-goals and future ideas

### Explicit non-goals

- Google, Apple, or Outlook calendar integration
- ICS feed or export
- Email, push, or scheduled in-app reminders
- Attendees, invitations, RSVPs, or shared event ownership
- Recurrence rules
- Hourly week/day scheduling grid
- Drag-to-reschedule
- Version milestones or historical session overlays
- Automatic date generation by AI

### Future ideas, not implied commitments

- Release-runway overlays that group pitching, asset, content, and release dates.
- Reusable event templates for studio sessions or content drops.
- Optional retrospective layers for completed sessions and milestones.
- One-way ICS export before any two-way external sync.
- Explainable collision summaries such as “three release tasks land this week.”

---

## 11. Product acceptance checklist

- [ ] Calendar appears as its own tab in both space-focus navigation variants.
- [ ] Active-space and All-spaces behavior is explicit and artist-safe.
- [ ] Every source in §4 renders and opens the correct source editor.
- [ ] Custom events support both all-day and timed semantics.
- [ ] Derived dates have no copied Calendar storage.
- [ ] Month and Agenda expose overdue, today, upcoming, and optional completed states.
- [ ] Visual behavior follows `CALENDAR-UX-SPEC.md` and existing TEMPO primitives.
- [ ] V1 ships without recurrence, external sync, attendee management, or background reminders.
