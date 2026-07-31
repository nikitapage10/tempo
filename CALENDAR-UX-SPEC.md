# TEMPO — Calendar UX and Visual Specification

*Status: Expanded and implemented (v0.61.0) at `/calendar`, including Month, Agenda, and creative Timeline views.*

**Related:** `CALENDAR-PRODUCT-SPEC.md` · `CALENDAR-TECHNICAL-DESIGN.md` · `DESIGN-SYSTEM-V2.md` · `tempo-design-spec.md`

---

## 1. Experience direction

Calendar should look like TEMPO learned to organize time—not like a third-party calendar embedded in TEMPO.

The page uses the existing dark depth system, Space Grotesk display titles, Inter for UI/data, quiet dividers, compact labels, and cursor-reactive light at the edge of interactive surfaces. The month grid is dense information, so it does not receive a full shader background. Light appears at deliberate edges, focus states, the Today marker, and empty-state atmosphere.

### Visual principles

1. **Studio schedule, not office calendar.** Emphasize releases, creative work, and context rather than meeting chrome.
2. **One dominant surface.** Month or Agenda is the primary panel; supporting controls do not become a stack of equal cards.
3. **Light reveals interaction.** Event surfaces glow at the pointer/focus edge using the existing spotlight primitive.
4. **Calm urgency.** Overdue is unmistakable but never floods an entire day cell red.
5. **Type plus color.** Every item includes an icon or source label; color is never the only cue.

---

## 2. Navigation and page entry

### Desktop rail

Add Calendar immediately after Today in both `MUSIC_MAIN_NAV` and `TASKS_MAIN_NAV`.

- Today retains `CalendarDays` in v1.
- Calendar uses a visually distinct calendar-range icon.
- `/calendar` follows the existing active-route slit and ice icon treatment.

### Mobile tab bar

- Music space: Today · Board · Calendar · Tasks · Add
- Tasks space: Today · Projects · Calendar · Tasks · Add

Calendar is never hidden in the Add menu. Five equal-width actions must still fit at 320px without truncated essential labels.

### Route and state

- Route: `/calendar`
- Query parameters: `view=month|agenda`, `date=YYYY-MM-DD`, `scope=space|all`, and repeated `source=` filters.
- Omit default values from the URL where practical.
- Browser Back restores the prior period, view, scope, and filters.

---

## 3. Desktop wireframes

### Month view

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Calendar                                  [Active space ▾]       [+ Event]   │
│ Deadlines, releases, and scheduled work                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [‹]  July 2026  [›] [Today]       [Month | Agenda]  [Sources ▾] [Completed] │
├──────────────────────────────────────────────────────────────────────────────┤
│ MON          TUE          WED          THU          FRI          SAT   SUN   │
│ 29           30           1            2            3            4     5     │
│              ┌ Track ─────────┐                    ┌ Release ───────┐       │
│              └────────────────┘                    └────────────────┘       │
│ 6            7            8            9            10           11    12    │
│ ┌ Task ─────────┐            TODAY •   ┌ Studio 14:00 ┐                    │
│ └───────────────┘                      └───────────────┘                    │
│ 13           14           15           16           17           18    19    │
│                           ┌ Pitching ─────┐                                  │
│                           └───────────────┘                                  │
│                           +2 more                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Annotations:

1. The `PageHeader` title/subtitle remains visually separate from the control bar.
2. Period navigation and Month/Agenda selection use existing button/chip patterns.
3. The grid is one `.panel` major surface with internal `border-line` dividers; do not nest 42 cards.
4. Leading/trailing month dates use `text-text-lo/50`; their items remain interactive.
5. Today uses a small ice dot/short flare and `text-text-hi`, not a solid blue circle.
6. Selected day uses `bg-bg-2/45` plus a slightly stronger edge; selection is not represented by glow alone.
7. Up to three event pills render in a cell at desktop sizes. `+N more` opens the day agenda.

### Agenda view

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Calendar                                  [Active space ▾]       [+ Event]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [‹]  Jul–Sep 2026 [›] [Today]       [Month | Agenda]  [Sources ▾]          │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ OVERDUE                       │ TODAY · THU JUL 30                           │
│ ┌ Task / artwork / context ─┐ │ ┌ Studio session · 2:00–5:00 PM ─────────┐ │
│ └────────────────────────────┘ │ └──────────────────────────────────────────┘ │
│                               │                                              │
│                               │ FRI JUL 31                                   │
│                               │ ┌ Release · Midnight Bloom ────────────────┐ │
│                               │ └──────────────────────────────────────────┘ │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

- At `xl`, a bounded overdue rail may sit beside the chronological list.
- Below `xl`, Overdue becomes the first collapsible group in the single column.
- Agenda rows may show related track artwork at 40–48px; month pills remain text-first.
- Date groups use sticky, quiet labels only when they do not conflict with the app's global sticky search header.

---

## 4. Mobile wireframe

```text
┌──────────────────────────────┐
│ Calendar          [+ Event]  │
│ Originals ▾                  │
├──────────────────────────────┤
│ [‹]  Today · Jul 30  [›]     │
│ [Agenda | Month] [Filters]   │
├──────────────────────────────┤
│ OVERDUE (2)                  │
│ ┌ Task                       │
│ │ Send pitch deck            │
│ │ Project · Jul 28           │
│ └────────────────────────────┘
│                              │
│ TODAY                        │
│ ┌ Studio · 2:00 PM           │
│ │ Vocal session              │
│ │ Track · Midnight Bloom     │
│ └────────────────────────────┘
│                              │
│ TOMORROW                     │
│ ┌ Release                    │
│ │ Midnight Bloom             │
│ └────────────────────────────┘
├──────────────────────────────┤
│ Today Board Calendar Tasks + │
└──────────────────────────────┘
```

- Mobile opens Agenda, even if desktop last used Month.
- Month remains available as a horizontally contained seven-column grid; the page itself must not scroll sideways.
- Month pills collapse to icon + truncated title. A cell shows at most two before `+N`.
- Filters open a bottom sheet/drawer with clear Apply and Clear actions.
- Event editor is a full-height, single-column dialog/drawer with a persistent Save action above the bottom tab bar safe area.

---

## 5. Calendar controls

### Header

- Title: **Calendar**
- Subtitle: **Deadlines, releases, and scheduled work.**
- Primary action: **New event**; ice treatment.
- Scope control: current space name or **All spaces**.

When New event is selected from All spaces, Space is the first required field and defaults to the currently active space—not an arbitrary first space.

### Period controls

- Previous and Next shift by one month in Month and by 90 days in Agenda.
- Today returns to the current local date and selects its group/cell.
- Month heading uses `font-display`; date numerals use Inter with `tabular-nums` where alignment helps.

### Source filters

Available groups:

- Tasks
- Track dates
- Projects
- Releases
- Events
- Show completed (separate toggle)

All source groups default on. Active filters appear as chips in desktop and as a count on the mobile Filters control. At least one source group must remain selected; otherwise present a clear “No sources selected” state rather than a broken-looking blank grid.

---

## 6. Event surface anatomy

### Compact month pill

```text
┌ icon · label/time · truncated title ┐
└──────────────────────────────────────┘
```

- Height: 24–28px desktop; minimum 32px touch target through cell hit-area on mobile.
- Radius: 6–7px, inside the 10px card / 16px major-panel system.
- Base: `bg-gradient-to-b from-[#17171e] to-bg-1`, `border-line`, `shadow-e1`.
- Hover/focus: `shadow-e2`, source-tinted spotlight edge, faint spotlight fill, title shifts toward `text-text-hi` or ice when appropriate.
- Content order: source icon, optional time, title. A short visually hidden phrase supplies full source/state context.
- Titles truncate to one line; full text is available to assistive technology and through the day agenda.

### Agenda row

- Reuse task/project row hierarchy: 10px radius, border, `bg-bg-1`, 12–16px padding, `shadow-e1`.
- Use `SpotlightCard` with approximately `radius={10}` and `size={180}`.
- Primary line: title.
- Secondary line: source label, time/date, space when in All spaces, and related track/project.
- Optional 40–48px signed artwork appears only for track-related rows; failure falls back silently to the source icon.
- Derived rows use a directional/open affordance; custom events expose an Edit label in the accessible name.

### Spotlight behavior

Calendar must reuse `components/ui/spotlight-card.tsx` and the global `.spotlight` rules.

- Month pills: compact configuration, approximately `radius={7}`, `borderWidth={1}`, `size={100–120}`, `fill={true}`.
- Agenda rows: standard compact-card configuration, approximately `radius={10}`, `borderWidth={1.5}`, `size={180}`, `fill={true}`.
- The shared `useSpotlightPointer` listener remains the only pointer listener for all mounted Calendar items.
- Edge and white-core opacity follow the existing CSS. Do not create Calendar-only neon, hue rotation, or a second pointer tracker.
- Hover and `focus-within` receive the same treatment. Touch selection uses `bg-bg-2`, border, and elevation rather than a persistent fake hover.
- `prefers-reduced-motion` removes transitions while preserving edge/focus visibility.

### Tone mapping

| Item/state | Spotlight tone | Additional non-color cue |
|---|---|---|
| Task | `ice` | Check-square icon + “Task” |
| Track deadline / next move | `ramp` | Music/arrow icon + “Target” or “Next” |
| Project deadline | `amber` | Folder icon + “Project” |
| Release / pitching | `amber` | Rocket/send icon + “Release” or “Pitching” |
| Custom event | `violet` | Kind-specific icon + kind label |
| Overdue or blocked | `warn` overrides source | Warning icon + “Overdue”/“Blocked” text |
| Completed task | `ok` | Check icon, muted text, optional strike-through |

Ice remains interaction and amber remains status. Violet is a rare accent reserved here for user-scheduled events; custom kinds do not introduce six new hues.

---

## 7. Month behavior

- Grid begins Monday to match TEMPO's weekly work framing.
- Render a complete 5- or 6-week grid for the selected month.
- Selecting empty cell space selects the day; a separate, labeled add affordance creates an all-day event on that date. Do not make any click in a cell silently create data.
- Selecting an item opens its authoritative destination.
- `+N more` opens a day agenda drawer/panel and moves focus to its heading.
- Multi-day custom all-day events render on each intersecting day in v1; do not attempt connected bars across cells.
- Timed events show local start time. All-day items omit time.
- Month cell order follows the product spec and remains stable between renders.

No drag/drop, resize handles, or hidden context menus in v1.

---

## 8. Agenda behavior

- Default range: today through 90 days, plus a bounded Overdue group.
- **Load next 90 days** extends the forward range without discarding current content.
- Overdue lists at most 50 open derived items and offers a link to the source list if more exist.
- Groups: Overdue, Today, Tomorrow, then explicit weekday/date headings.
- Timed items sort by displayed local time; all-day items follow the source priority defined in the product spec.
- A date with no visible items is omitted.
- Changing a filter updates counts and groups without moving keyboard focus unexpectedly.

---

## 9. Custom-event editor

### Field order

1. Title
2. Kind
3. Space
4. All-day toggle
5. Start date and, when timed, start time
6. Optional end date/time
7. Timezone summary/change control for timed events
8. Related to (one track or one project)
9. Location
10. Description
11. Save; Delete in edit mode

### Behavior

- Opening from a month day pre-fills that date and all-day mode.
- Opening from Agenda New event pre-fills today's date and all-day mode.
- Turning all-day off defaults the start to the next half-hour and preserves the chosen date.
- Turning all-day on preserves the displayed local dates and clears timed values only on successful save.
- End is optional. If supplied, it must be on/after an all-day start or strictly after a timed start.
- Changing Space clears an incompatible related item with an inline explanation.
- Failed saves preserve every entered value.
- Close with unsaved changes requires discard confirmation.
- Delete uses the existing confirm-dialog pattern and restores focus to New event or the originating item.

---

## 10. Source navigation contract

Derived items do not use a Calendar editor. Activation navigates to and focuses the authoritative field:

- Task: `/tasks?edit=<task-id>`
- Track target: `/track/<track-id>?edit=deadline`
- Track next move: `/track/<track-id>?edit=next-action`
- Project deadline: `/projects/<project-id>?edit=deadline`
- Release date: `/projects/<project-id>?edit=release-date`
- Pitching deadline: `/projects/<project-id>?edit=pitching-deadline`

The destination page owns dialog opening, focus, save, error, and return behavior. Unsupported/removed IDs fall back to the normal destination page with a calm notice.

---

## 11. States

### Loading

- Skeleton header controls at stable widths.
- Month: one major grid skeleton with date labels and varied quiet pill shapes.
- Agenda: date-heading and row skeletons matching final regions.
- Do not show three equal mystery cards.

### Empty

- No dates in period: **Nothing scheduled here yet.** Supporting copy mentions that TEMPO deadlines appear automatically. Action: New event.
- Filters hide results: **No items match these filters.** Action: Clear filters.
- All spaces but no spaces: direct user to Settings.
- Empty states may use the approved restrained shader treatment; the active data grid may not.

### Error and partial data

- Full load failure: quiet panel with Retry.
- One source fails: render successful sources, show a compact warning naming the unavailable group, and allow retry.
- Save failure: inline editor message plus toast; keep the editor open.
- Deleted source: remove item after refetch; if activation races deletion, destination handles not-found.

---

## 12. Accessibility and interaction checklist

- Month grid uses the ARIA grid pattern with one roving `tabIndex`; arrow keys move by day, Home/End by week edge, Page Up/Down by month, and Enter opens the selected day.
- Event pills inside a day remain reachable after the day cell. Escape returns focus from day agenda/editor to the originating control.
- Every item announces title, source, date/time, urgency/completion, and space when relevant.
- Keyboard focus uses the same spotlight edge plus the existing visible ice focus ring.
- Icon-only controls have accessible names and at least 44×44px touch targets on mobile.
- State is never color-only.
- Live announcements are limited to meaningful events such as save success, range loaded, and filter-result count; pointer hover is never announced.
- Dialogs trap and restore focus.
- Layout remains readable at 320px without page-level horizontal scrolling.
- Contrast is maintained over spotlight fill and any empty-state lightfield.
- Reduced motion disables non-essential transitions and smooth scrolling.

---

## 13. Visual acceptance checklist

- [ ] Calendar uses existing `PageHeader`, panel, well, button, chip, dialog, toast, and spotlight patterns where appropriate.
- [ ] No new font, generic white calendar canvas, saturated category rainbow, or full-page shader appears.
- [ ] Month items glow only on hover/focus and use a compact spotlight configuration.
- [ ] Agenda rows visually belong beside current Task and Project rows.
- [ ] Artist palette tokens flow into spotlight tones automatically.
- [ ] Today and selected-day states are calm and distinct from hover.
- [ ] Dense days remain legible and expose the complete list.
- [ ] Touch, keyboard, focus, error, empty, and reduced-motion states are designed—not left to implementation guesswork.
