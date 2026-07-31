# TEMPO — Calendar Technical Design

*Status: Expanded and implemented (v0.61.0). Database deployment uses `migrations/037_calendar_events.sql` followed by `migrations/038_calendar_planning.sql`.*

**Related:** `CALENDAR-PRODUCT-SPEC.md` · `CALENDAR-UX-SPEC.md` · `TECHNICAL-ARCHITECTURE.md` · `DATA-MODEL.md` · `SECURITY-AND-PERMISSIONS.md`

---

## 1. Architecture summary

Calendar is a read-time aggregation of authoritative TEMPO records plus one new owner-managed `calendar_events` table.

```text
tasks ───────────────┐
tracks ──────────────┤
projects ────────────┼─ browser Supabase queries + RLS ─ normalize ─ CalendarItem[]
release_details ─────┤                                      │
calendar_events ─────┘                                      ├─ Month
                                                            └─ Agenda
```

The authenticated client follows the existing browser → Supabase + RLS pattern. No service-role route, synchronization worker, reminder scheduler, or materialized calendar copy is required.

### Boundaries

- Existing entity APIs remain authoritative for derived dates.
- `lib/api/calendar.ts` owns range queries and normalization only.
- `lib/api/calendar-events.ts` owns custom-event CRUD.
- React Query owns caching and invalidation.
- Calendar UI consumes one normalized interface and does not branch on raw table rows.

---

## 2. Normalized interface

The implementation should add the following concepts to `lib/types.ts` or a focused `lib/calendar/types.ts` module.

```ts
export type CalendarSource =
  | "task_due"
  | "track_deadline"
  | "track_next_action"
  | "project_deadline"
  | "release_date"
  | "pitching_deadline"
  | "custom_event";

export type CalendarKind =
  | "task"
  | "track"
  | "project"
  | "release"
  | "studio_session"
  | "meeting"
  | "content"
  | "live_show"
  | "personal"
  | "other";

export type CalendarTemporal =
  | {
      mode: "all_day";
      startDate: string;          // YYYY-MM-DD
      endDateInclusive: string | null;
    }
  | {
      mode: "timed";
      startsAt: string;           // RFC 3339 UTC from Postgres timestamptz
      endsAt: string | null;
      timezone: string;           // IANA identifier used for display
    };

export type CalendarRelation =
  | { type: "track"; id: string; label: string; artworkPath: string | null }
  | { type: "project"; id: string; label: string }
  | null;

export type CalendarItem = {
  id: string;                     // `${source}:${sourceId}`
  source: CalendarSource;
  sourceId: string;
  kind: CalendarKind;
  ownerUserId: string;
  spaceId: string;
  spaceLabel: string;
  title: string;
  subtitle: string | null;
  temporal: CalendarTemporal;
  relation: CalendarRelation;
  state: "default" | "blocked" | "overdue" | "today" | "completed";
  destinationHref: string;
  editOwner: "source" | "calendar";
};
```

### Normalization invariants

- Derived records always normalize to `mode: "all_day"` using their Postgres `date` value unchanged.
- Timed custom events always return UTC timestamps plus a valid IANA timezone.
- `id` is stable and source-prefixed, preventing collisions between tables.
- `destinationHref` follows the source navigation contract in the UX spec.
- `editOwner` is `calendar` only for `custom_event`.
- A custom event related to a track/project uses that entity as `relation`; an unlinked event uses `null`.
- A derived item uses the most useful relation without granting additional reads. For example, a task may expose its accessible track or project label only when the caller can already read it.
- State precedence is `completed` → `overdue` → `blocked` → `today` → `default`; custom events never derive `overdue` or `blocked`.

---

## 3. `calendar_events` data model

Use the next available migration number at implementation time; do not renumber or modify an already-applied migration.

```sql
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  space_id uuid not null
    references spaces(id) on delete cascade,
  track_id uuid
    references tracks(id) on delete set null,
  project_id uuid
    references projects(id) on delete set null,
  title text not null,
  kind text not null default 'other'
    check (kind in (
      'studio_session', 'meeting', 'content',
      'live_show', 'personal', 'other'
    )),
  description text,
  location text,
  all_day boolean not null default true,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_events_one_relation check (
    num_nonnulls(track_id, project_id) <= 1
  ),
  constraint calendar_events_temporal_shape check (
    (
      all_day
      and start_date is not null
      and starts_at is null and ends_at is null and timezone is null
      and (end_date is null or end_date >= start_date)
    )
    or
    (
      not all_day
      and start_date is null and end_date is null
      and starts_at is not null and timezone is not null
      and (ends_at is null or ends_at > starts_at)
    )
  ),
  constraint calendar_events_title_length check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint calendar_events_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint calendar_events_location_length check (
    location is null or char_length(location) <= 240
  )
);
```

### Date semantics

- `start_date` and `end_date` are used only for all-day events. `end_date` is inclusive.
- `starts_at` and `ends_at` are used only for timed events and persist as UTC `timestamptz` values.
- `timezone` is an IANA identifier such as `America/Denver`, never a numeric offset.
- Display a timed event in its stored timezone. A future preference may offer viewer-local display, but v1 does not silently reinterpret it.
- Converting between all-day and timed happens in the editor model, then saves one valid temporal shape atomically.
- Database timestamps remain the source of truth for audit fields.

### Ownership and relation validation

A `BEFORE INSERT OR UPDATE` trigger must reject events when:

- `space_id` is not owned by `auth.uid()`.
- A related track is not owned by the same user or has a different `space_id`.
- A related project is not owned by the same user, has no `space_id`, or has a different `space_id`.
- `timezone` is not present in `pg_timezone_names` for a timed event.

The selected space establishes the event's artist through `spaces.artist_id`; the client offers only spaces from the active artist. The API repeats friendly validation, but the database is authoritative. The trigger must not broaden caller access or expose inaccessible entity names in errors.

### Indexes and update timestamp

```sql
create index idx_calendar_events_space_start_date
  on calendar_events (space_id, start_date)
  where all_day;

create index idx_calendar_events_space_starts_at
  on calendar_events (space_id, starts_at)
  where not all_day;

create index idx_calendar_events_user_created
  on calendar_events (user_id, created_at desc);
```

Use the project's established `updated_at` trigger pattern rather than adding client-authored update timestamps.

---

## 4. RLS and permissions

Enable RLS before exposing the table.

```sql
alter table calendar_events enable row level security;

create policy own_calendar_events_select
  on calendar_events for select
  using (user_id = auth.uid());

create policy own_calendar_events_insert
  on calendar_events for insert
  with check (user_id = auth.uid());

create policy own_calendar_events_update
  on calendar_events for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy own_calendar_events_delete
  on calendar_events for delete
  using (user_id = auth.uid());
```

Additional constraints:

- The relation-validation trigger enforces same-owner/same-space linkage; UI filtering is not authorization.
- Track collaborators gain no `calendar_events` policy in v1.
- All-spaces aggregation first resolves space IDs belonging to the active artist. It never means all rows for the account across artists.
- Legacy projects with `space_id is null` are excluded from artist Calendar aggregation until assigned to a space; do not guess their artist.
- Do not use the service role for authenticated Calendar reads or writes.

---

## 5. Range queries and source normalization

### Range model

Use half-open query ranges internally: `[rangeStart, rangeEndExclusive)`.

- Month: first visible Monday through the Monday after the final visible Sunday (35 or 42 days).
- Agenda: today through 90 days after today.
- Load next: extend `rangeEndExclusive` by another 90 days.
- Overdue: separate query for at most 50 incomplete derived items before today. Custom events do not become overdue; a past event is history, not incomplete work.

### Source queries

`fetchCalendarItems(input)` should run independent source queries in parallel and return partial results plus structured source errors.

```ts
type CalendarQueryInput = {
  artistId: string;
  scope: { type: "space"; spaceId: string } | { type: "all" };
  rangeStart: string;             // local YYYY-MM-DD
  rangeEndExclusive: string;      // local YYYY-MM-DD
  sources: CalendarSourceGroup[];
  showCompleted: boolean;
  timezone: string;
};

type CalendarQueryResult = {
  items: CalendarItem[];
  errors: { group: CalendarSourceGroup; message: string }[];
  truncatedOverdue: boolean;
};
```

Query rules:

- **Tasks:** `due_date >= start` and `< end`; exclude `done` unless requested. Overdue query uses `< today` and non-done status.
- **Track deadline:** query `deadline` in range.
- **Track next action:** query `next_action_due` in range; use `next_action || "Next move"` for title.
- **Project deadline:** active projects with deadline in range.
- **Release:** join `release_details` to accessible, space-scoped release projects; range-filter `release_date` and `pitching_deadline` independently.
- **Custom all-day:** intervals overlap when `start_date < end` and `coalesce(end_date, start_date) >= start`.
- **Custom timed:** query a conservative UTC envelope covering the requested local dates across supported offsets, then format each result in its stored IANA timezone and retain only events whose displayed local interval intersects the requested date range. This prevents an event near a UTC boundary from disappearing because its timezone differs from the viewer's.

Do not collapse two semantically different fields that land on the same date. Normalize both and let the UI group them.

### Scope resolution

- Active space: use exactly `activeSpaceId` after confirming it belongs to the active artist.
- All spaces: obtain the active artist's space IDs from the existing space query and filter every source by those IDs.
- Never use `user_id` alone as the All-spaces artist boundary.

---

## 6. API and React Query design

### API modules

`lib/api/calendar.ts`

- `fetchCalendarItems(input)`
- Source-specific query/normalization helpers kept private or exported only for tests.
- `deriveCalendarState(item, today)` as a pure function.
- `sortCalendarItems(items, timezone)` as a pure deterministic function.

`lib/api/calendar-events.ts`

- `createCalendarEvent(input)`
- `updateCalendarEvent(id, patch)`
- `deleteCalendarEvent(id)`
- Client-side friendly validation before Supabase mutation.

### Hooks and keys

```ts
["calendar", artistId, scopeKey, rangeStart, rangeEndExclusive,
 sourceKey, showCompleted, timezone]

["calendar-event", eventId]
```

Keep keys serializable and stable. Sort source group names before building `sourceKey`.

### Invalidation

- Custom-event create/update/delete invalidates matching `calendar` roots for the active artist and updates the individual event key when applicable.
- Task mutations invalidate Tasks, Today stats, and Calendar roots.
- Track deadline/next-action mutations invalidate Track, Tracks, Today/attention, and Calendar roots.
- Project/release date mutations invalidate Project(s), release queries, and Calendar roots.
- Prefer source-row cache updates followed by a background Calendar refetch; never optimistically invent a server UUID.

### Partial failures

Use settled parallel queries rather than failing the whole aggregation on one source. Return safe user-facing group errors; log technical details through the existing error path. A custom-event query failure must not hide derived deadlines, and vice versa.

---

## 7. Route and component structure

Suggested implementation boundaries:

```text
app/(app)/calendar/page.tsx
components/calendar/
  calendar-toolbar.tsx
  month-view.tsx
  month-cell.tsx
  calendar-item-surface.tsx
  agenda-view.tsx
  day-agenda.tsx
  event-editor.tsx
lib/calendar/
  types.ts
  normalize.ts
  range.ts
```

The exact filenames may follow repository conventions, but preserve these responsibilities:

- Page owns URL state, active artist/space, range, and top-level queries.
- Month/Agenda receive normalized items and never issue table-specific queries.
- One `CalendarItemSurface` maps source/state to icon, label, tone, accessible name, and destination.
- Event editor owns draft conversion between all-day and timed forms.
- Date/range functions are pure and tested independently.

### Source deep links

Calendar emits:

- `/tasks?edit=<task-id>`
- `/track/<track-id>?edit=deadline`
- `/track/<track-id>?edit=next-action`
- `/projects/<project-id>?edit=deadline`
- `/projects/<project-id>?edit=release-date`
- `/projects/<project-id>?edit=pitching-deadline`

Each destination page must add query parsing that opens/focuses the specified source editor, preserves existing defaults for unknown values, and removes or replaces the query after a successful close where appropriate.

---

## 8. Spotlight and visual implementation

Calendar reuses `SpotlightCard`; it must not implement its own pointer tracker.

### Month items

```tsx
<SpotlightCard
  tone={toneForCalendarItem(item)}
  radius={7}
  borderWidth={1}
  size={110}
  fill
>
  {/* compact event button/link */}
</SpotlightCard>
```

### Agenda items

```tsx
<SpotlightCard
  as="article"
  tone={toneForCalendarItem(item)}
  radius={10}
  borderWidth={1.5}
  size={180}
  fill
>
  {/* agenda row */}
</SpotlightCard>
```

Implementation rules:

- Preserve the shared, ref-counted page-level pointer listener in `spotlight-card.tsx`.
- Do not add `pointermove` handlers to month cells or events.
- Render spotlight only for mounted visible item surfaces; the month cap limits the normal grid to three per desktop cell/two per mobile cell.
- Reuse palette tones: task `ice`, track `ramp`, project/release `amber`, custom event `violet`, overdue/blocked `warn`, completed `ok`.
- `warn` and `ok` are state overrides; source icon/label stays visible.
- Keep the existing `focus-within` and reduced-motion CSS behavior.
- The 42 day cells are plain grid regions inside one panel, not nested `SpotlightCard` instances.
- Do not place the Spectra shader behind the populated month grid. Approved empty-state treatment may use the existing shader component.

### Performance check

The shared spotlight listener writes pointer variables once per animation frame regardless of event count. Profile a dense 42-day grid and Agenda list; if paint becomes expensive, retain the edge effect on visible items and virtualize only Agenda—not the month grid.

---

## 9. Validation and failure modes

### Client validation

- Trim title; require 1–160 characters.
- Require a valid selected space.
- Require one valid temporal shape.
- Validate end ordering before mutation.
- Require `Intl.DateTimeFormat` acceptance of the IANA timezone.
- Restrict related choices to accessible records in the selected space.
- Clear incompatible relation after explicit space change.

### Server/database validation

- RLS owner checks.
- Relation ownership/space trigger.
- Temporal and length constraints.
- Timezone lookup.
- `updated_at` trigger.

### Failure behavior

- Mutation error returns no optimistic fake row; keep editor draft.
- Deleted related entity sets the relation null and preserves the event.
- Deleted space cascades its custom events after existing space-deletion confirmation.
- Source query errors are isolated by group.
- Invalid URL date/view/scope values fall back to today, responsive default view, and active space.
- A timed event whose timezone becomes unsupported remains readable using its stored UTC time and a visible fallback notice; edits require choosing a valid timezone.

---

## 10. Testing strategy

### Pure unit coverage

- Visible month range for 5- and 6-week months, leap years, and Monday starts.
- Half-open range boundaries.
- All-day inclusive end overlap.
- Timed overlap and timezone conversion across DST transitions.
- Stable source/state/tie-break sorting.
- Overdue/today/completed derivation.
- Source-to-tone, icon, label, and destination mapping.

### Data and RLS coverage

- Owner can CRUD own custom events.
- Another user cannot select or mutate them by guessed UUID.
- All spaces includes only active-artist spaces.
- Cross-space or cross-owner track/project relations fail at the database.
- At most one relation is accepted.
- Invalid temporal shapes, end ordering, timezone, and lengths fail.
- Deleting a related track/project nulls the relation; deleting a space removes its custom events.

### Integration coverage

- Each derived source normalizes correctly and opens the specified editor.
- Changing a source date invalidates/refetches Calendar.
- Completed tasks remain hidden until enabled.
- Project deadline and release date on the same day both render with distinct labels.
- One failed source query leaves other sources usable.
- Creating from All spaces still requires and saves a concrete space.
- Custom-event all-day ↔ timed conversion preserves intended local date.

### UI and accessibility coverage

- Month roving focus and arrow/Page/Home/End keys.
- Day agenda and editor focus restoration.
- Dense-day `+N more` behavior.
- Month/Agenda URL restoration with Back/Forward.
- Spotlight appears on hover and keyboard focus, not as the only selected state.
- Reduced motion removes transitions.
- Source/state is announced without color.
- 320px mobile has no page-level horizontal overflow.

### Performance coverage

- Dense 42-day month with capped visible pills.
- Agenda with 50 overdue plus 90 days of upcoming items.
- Confirm one shared spotlight pointer listener and at most one pointer-variable write per animation frame.

---

## 11. Implementation sequence

1. Add the migration, constraints, relation-validation trigger, indexes, RLS, and generated database types.
2. Add date/range utilities, normalization, source queries, custom-event API, and unit/RLS tests.
3. Add Calendar query hooks and invalidation from existing task/track/project/release mutations.
4. Add `/calendar`, navigation entries, responsive Month/Agenda shells, filters, and URL state.
5. Add shared item surfaces using `SpotlightCard`, day agenda, and custom-event editor.
6. Add authoritative deep-link handling to Tasks, Track, and Project pages.
7. Complete accessibility, partial-error, empty/loading, timezone, mobile, and performance verification.
8. Update `PRODUCT.md`, `FEATURE-SPECS.md`, `DATA-MODEL.md`, `TECHNICAL-ARCHITECTURE.md`, `SECURITY-AND-PERMISSIONS.md`, version, and changelog only when implementation actually ships.

---

## 12. Technical acceptance checklist

- [ ] Derived dates are normalized at read time and never copied into `calendar_events`.
- [ ] Custom events support valid all-day and timed temporal shapes.
- [ ] Range queries are bounded and artist/space-safe.
- [ ] RLS and database triggers enforce owner and relation boundaries.
- [ ] Source mutation invalidation reaches Calendar.
- [ ] Partial source failure does not blank the page.
- [ ] Month and Agenda consume the same `CalendarItem` contract.
- [ ] Source deep links focus the authoritative editor.
- [ ] Event surfaces reuse the existing shared `SpotlightCard` implementation.
- [ ] No recurrence, attendee, sync, reminder worker, or drag/drop code enters v1.
