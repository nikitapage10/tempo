# TEMPO — Team Operations UX and Interaction Specification

*Status: Implemented v1 UX contract. The mode-aware Team surface, review-before-approval invitations, work queue, schedule, brief, room entry, and starter-kit preview are wired in the shared web app.*

**Related:** `TEAM-OPERATIONS-PRODUCT-SPEC.md` · `TEAM-OPERATIONS-TECHNICAL-DESIGN.md` · `DESIGN-SYSTEM-V2.md` · `ARTIST-ORIGIN-ONBOARDING-SPEC.md`

---

## 1. Experience direction

Team Operations should feel like a quiet control room around the music, not an HR portal or office task tracker.

The experience has three visual centers:

1. **My Work** is action-first and private to the signed-in person.
2. **Team** is relationship-first: people, roles, access, and lifecycle.
3. **Team Brief** is context-first: the artist, current priorities, working norms, and useful links.

The team room remains a conversation surface and uses the existing Messages language. It must not become a second notification center or an always-moving activity feed.

### Visual principles

- One dominant surface per screen; avoid a grid of equally loud cards.
- Artist accents provide context but never encode permission or urgency alone.
- Avatars clarify responsibility; names remain visible beside them.
- Ice indicates actions and focus. Amber indicates current, waiting, or attention. Warn is reserved for overdue or access-ending consequences.
- Assignment and permission are always written in words.
- Every cross-artist row carries an artist name or mark; color alone is insufficient.
- Motion remains restrained and respects reduced motion.

---

## 2. Information architecture

### Artist-owned workspace

`Artist` hover/flyout continues to include Profile, Team, and Stats. Team gains three internal tabs:

- **People** — roster, invitations, roles, access, lifecycle
- **Brief** — artist orientation and current priorities
- **Waiting** — work delegated by or awaiting the artist

The team room is opened from a persistent **Team room** action on Team and from Messages. It is not another primary rail destination.

### Pro personal home

The existing Pro navigation remains Today, Calendar, Projects, Tasks, Profile, Artists, Social, and Settings. **Artists** evolves into the operating home with:

- **My Work**
- **Schedule**
- **Roster**

The existing roster overview becomes the Roster tab rather than disappearing.

### Messages

Artist team rooms appear in a distinct **Teams** section alongside People and Support. A room has the artist mark and “Team” secondary label. Direct messages remain separate.

### Deep-link contract

Pro-home state uses stable URL parameters:

- `/team?tab=work|schedule|roster`
- `artist=<artist-id>` only in the private Pro home; omit for all artists
- `kind=task|review|feedback|calendar`
- `state=open|completed`
- `cursor=<opaque>` for paginated history

Artist Team uses:

- `/team?tab=people|brief|waiting`
- `member=<membership-id>` opens the member sheet
- `invite=<membership-id>` opens the invitation detail

Opening an authoritative item switches artist and space through the existing providers before navigation. Browser Back returns to the same filters and scroll anchor.

---

## 3. Pro home wireframes

### 3.1 My Work — desktop

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Artists you work with                                  [Availability ▾]    │
│ Everything waiting on you, across your roster                              │
├────────────────────────────────────────────────────────────────────────────┤
│ [My Work] [Schedule] [Roster]         [All artists ▾] [Kind ▾] [Open ▾]    │
├────────────────────────────────────────────────────────────────────────────┤
│ DUE NOW · 3                                                                │
│ ┌ PRESIDENT ─ Task ─────────────────────────────────────────── [Complete] ┐ │
│ │ Send final master metadata · Album rollout · due today                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Northstar ─ Review ───────────────────────────────────────── [Listen] ┐  │
│ │ Review Mix 7 · requested by Maya · overdue yesterday                  │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ NEXT                                                                       │
│ ┌ Kai Vale ─ Feedback ──────────────────────────────────────── [Respond] ┐ │
│ │ “Does the second chorus lift enough?” · due Friday                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

Annotations:

1. Rows sort by transparent urgency: overdue, due today, explicit review, upcoming, no due date.
2. Artist context leads every row. The work title remains the strongest text.
3. The right action is the next valid operation, not a generic menu.
4. A secondary overflow menu offers Reassign where permitted, Snooze notification, and Open source.
5. Completing a task checks the authoritative task. It does not merely dismiss the inbox row.
6. Completed history is behind the State filter and never mixed into the open queue.

### 3.2 Schedule — desktop

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [My Work] [Schedule] [Roster]                    Week of Aug 17 [‹] [›]    │
├────────────────────────────────────────────────────────────────────────────┤
│ Mon 17           Tue 18           Wed 19           Thu 20           Fri 21 │
│ PRESIDENT        Personal         Northstar         PRESIDENT               │
│ Campaign review  Studio hold      Release check     Travel                   │
│ 10:00–10:45      13:00–16:00      all day           08:00–11:00              │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Two readable events overlap Tuesday, 13:00–14:00. [Review]               │
└────────────────────────────────────────────────────────────────────────────┘
```

- This is a private derived view over events the Pro may already read.
- Conflicts are factual overlap notices, not “overbooked” judgments.
- Artist owners never receive this combined view.
- Selecting an item opens the authoritative artist Calendar.
- Personal-home events participate in conflicts but are never exposed inside an artist workspace.

### 3.3 Roster

Retain the existing overview totals and artist cards. Add:

- Declared availability control at the page level
- Per-artist notification control
- Next assigned action, when one exists
- Team room unread count
- Enter workspace and Open brief actions

Do not show a Pro's private assignment count for other artists on any artist-owned page.

---

## 4. Artist Team wireframes

### 4.1 People

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Team                                                      [Team room]      │
│ Everyone working with this artist, and exactly what they can reach         │
├────────────────────────────────────────────────────────────────────────────┤
│ [People] [Brief] [Waiting]                              [+ Invite a Pro]    │
├────────────────────────────────────────────────────────────────────────────┤
│                existing team constellation / photo fan                     │
├────────────────────────────────────────────────────────────────────────────┤
│ Maya Chen      Manager       Active      4 open handoffs     [Manage]       │
│ Leo Grant      Publicist     Pending     Sent Aug 15          [Review]       │
│ Jo Rivera      Photographer  Suspended   Since Aug 12         [Manage]       │
└────────────────────────────────────────────────────────────────────────────┘
```

- Active, Pending, Suspended, and Ended are explicit text states.
- Ended people are hidden by default under History.
- “Open handoffs” is shown only to people allowed to manage those source items.
- The visible relationship label may be custom; access summary remains separate.

### 4.2 Waiting

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Waiting on the team                                    [Person ▾] [Kind ▾] │
├────────────────────────────────────────────────────────────────────────────┤
│ Maya · Task     Confirm distributor delivery           due today  [Open]   │
│ Leo · Review    Approve press copy                      due Fri    [Open]   │
│ Unassigned      Add final songwriter splits            no date    [Assign] │
└────────────────────────────────────────────────────────────────────────────┘
```

The artist sees work for this artist only. No workload or assignments from another artist appear, even if the same Pro is involved.

---

## 5. Invitation experience

### 5.1 Artist flow

Use a four-step dialog/sheet:

1. **Who** — find by handle/email or enter a new email.
2. **Relationship** — choose team role preset and optional custom label.
3. **Access** — review each area in plain language.
4. **Review** — personal note, expiration for email invite, and final summary.

The Access step groups areas instead of presenting ten identical dropdowns at once:

- Music: Catalog, Audio & files, Feedback
- Operations: Tasks, Calendar, Releases, Performances
- Presence: Stats, Social
- Administration: Team

Each row offers None/Read/Write only when those levels are truly supported. Stats shows None/Read. Social and Team show **Owner only** until their dedicated delegated-write packages ship.

The review sentence should be literal:

> Maya can edit tasks, calendar, releases, and performances; read the catalog, feedback, and stats; and cannot access audio files, Social management, team administration, personal attributes, account settings, or other artists.

### 5.2 Invitee flow

The pending invitation card expands into a detail sheet before approval:

- Artist identity and inviter
- “Join as …” relationship label
- Personal note
- Exact read/edit summary
- Explicit private boundaries
- Approve and Decline

Approval may not occur from the collapsed card without first showing the access summary. The sheet remembers scroll position; keyboard focus returns to the originating card.

### 5.3 Existing versus new person

- Existing TEMPO person: in-app notification and approval.
- New person: established email link and account creation path.
- Both see equivalent access language.
- Raw tokens never appear after the initial copy/link delivery flow.

### 5.4 Role-based starter-kit prompt

The first personal-home opening after Passage may show a full-page welcome panel titled **Set up a starting point?** It is optional onboarding, not a gate.

The panel contains:

1. **Your work** — selectable role cards prefilled from Passage: Manager, Label / label owner, Publicist, Tour manager, Agent, Assistant, or Custom.
2. **Home emphasis** — one primary lens for the opening layout. Multi-role Pros still get templates from every selected kit.
3. **What TEMPO will add** — a literal preview grouped into Home layout, Saved views, Reusable templates, and Optional private sample board.
4. **Confirmation** — **Set up my workspace**, **Remind me later**, and **Start blank**.

Role cards describe the work pattern, not status or authority. Selecting Manager cannot imply access to an artist, and selecting Label cannot claim ownership of a label.

The preview uses concrete counts and names, for example:

> Publicist + Tour manager will add 2 saved views and 7 reusable templates to your private workspace. Schedule will be your home emphasis. No artist workspace or access will change.

The optional sample board is off by default. If enabled, every sample project/task is visibly marked **Private starter example** and can be removed together immediately after setup. Generic templates never invent names, dates, contacts, venues, releases, or campaigns.

After installation, a result panel lists Added, Already present, and Not added. It links to the new views/templates and offers **Remove untouched starter examples**. It does not offer a destructive global undo for items the Pro has edited.

Settings → Workspace → Starter kits remains the durable entry point. It shows installed kit/version, what was originally supplied, and these actions:

- Add another kit
- Review kit contents
- Restore only missing defaults
- Remove untouched starter examples

Changing Passage roles later may suggest a kit once, but never installs it automatically or resets the home.

---

## 6. Member access sheet and lifecycle

The member sheet contains four tabs:

- **Overview** — person, industry roles, team role, availability, open handoffs
- **Access** — grouped permission editor and effective summary
- **Work** — this artist's assigned tasks/reviews only
- **History** — membership and access events, no creative content

### Actions

- Change relationship role
- Reset to role defaults
- Save customized access
- Suspend access
- Resume access
- End access

Changing a role does not silently overwrite customized access. Ask:

- Keep current access and only rename the role
- Apply the new role defaults

### Suspension

Suspension confirmation explains:

- Access stops immediately
- Open assignments remain assigned but are marked blocked by suspended access
- Team room access pauses
- The person can be resumed later

### End access

End access opens a full-screen review when open responsibilities exist:

```text
End Maya's access

4 tasks                         [Reassign all ▾]
2 review requests               [Reassign all ▾]
1 upcoming event they created   [Keep / Reassign owner]
Team room                       Access ends; messages remain attributed

[Cancel]                                            [End access]
```

The final button stays disabled until every open task/review has an explicit outcome: reassign, cancel, or leave unassigned. Ending access never deletes authored work or messages.

### Leaving as a Pro

The same review is shown from the Pro side. A Pro may suggest reassignment but cannot choose a recipient they lack permission to assign. If necessary, items become unassigned and the artist owner is notified.

---

## 7. Assignment interactions

### Task editor additions

- Assignee field after due date
- Artist owner first, then active eligible team members
- Search by name or relationship role
- “Unassigned” is a deliberate valid state
- Current assignee avatar/name on task rows and cards
- “Assigned by …” only in detail/history, not every dense row

### Eligibility messaging

If a selected assignee loses access before save:

> Maya no longer has Tasks access for this artist. Choose someone else or leave this unassigned.

Do not offer “grant access now” inside assignment; permission changes deserve their own review flow.

### Optimistic behavior

- Task rows may update assignee optimistically after the server validates.
- On rejection, restore the previous assignee and show the current reason.
- Assignment history and notification are server-created; the client never fakes them.

### Completed work

Completion removes an item from open My Work after a short undo window only when the existing task behavior supports undo safely. Otherwise use the established optimistic task toggle and refetch.

---

## 8. Review-request interactions

### Entry points

- Version timeline: Request review
- Version decision surface: Ask for decision
- Comment thread: Assign follow-up
- Release workspace: Request release check

### Form

- Person (required, eligible members only)
- Request (required, short plain text)
- Due date/time (optional)
- Source summary (read-only)

### My Work actions

| Request kind | Immediate action |
|---|---|
| Bounce review | Listen |
| Version decision | Decide |
| Comment follow-up | Respond |
| Release check | Review |

Closing a request requires a source-appropriate result or an explicit “Complete without response” with a note. New versions do not silently close reviews of older versions; the row says which version was requested.

---

## 9. Artist Team Brief

### Layout

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ PRESIDENT · Team Brief                                   Updated Aug 16    │
│ What the team needs to know right now                                       │
├───────────────────────────────┬────────────────────────────────────────────┤
│ Current signal                │ Right now                                  │
│ existing artist story         │ pinned release / project / task / date     │
├───────────────────────────────┼────────────────────────────────────────────┤
│ How we work                   │ The team                                   │
│ owner-written norms           │ people + relationship responsibilities     │
├───────────────────────────────┴────────────────────────────────────────────┤
│ Links & references                                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Derived content

- Artist name, emblem, story, location, and links
- Active team roster
- Current release and transparent readiness
- Pinned tracks/projects/events/tasks
- Member's exact access summary

### Authored content

- Welcome note
- How we work / communication expectations
- General timezone or working rhythm
- Useful links
- Optional note on each pinned priority

### Edit behavior

- Owner edits by default.
- Delegated Team Write may edit only after its separate security gate ships.
- Links require `https://` or `http://`; no metadata scraping.
- Reorder pins/links with keyboard-accessible controls as well as drag.
- Removing a pin does not delete the source item.
- Updated markers are private client/member state; the artist does not get read receipts.

---

## 10. Team room

Use the current conversation workspace and message bubbles. Add artist-team context in the header:

- Artist mark and name
- Active member count
- Open Team Brief
- Search, pins, media, mute, archive

### Composer

- Plain message, voice note, and existing supported attachments
- Link work action opens a searchable picker of permitted tasks/tracks/projects/releases/reviews/events
- Linked cards contain only allowlisted snapshot fields and a deep link
- `@` mentions active room members and creates a grouped notification

### Pins

Room admins may pin as:

- Decision
- Handoff
- Reference

Pinned classification is metadata around the existing message, not copied text. Removing a pin leaves the message.

### System events

Show restrained inline dividers for:

- Person joined, left, suspended, resumed
- Review requested/completed
- Team Brief materially updated

Do not post task edits, file uploads, typing state, read state, or every access-toggle change into the room.

### Identity

Every message shows the sender's human profile. There is no “send as artist” option in this initiative.

---

## 11. Availability and notification preferences

### Availability

Private Pro-home control:

- Available
- Limited
- Unavailable

Optional fields:

- Until date
- Short note, maximum 160 characters
- IANA timezone
- Working-days pattern

Artists see only the declared state, until date, note, and timezone when the Pro chooses to share them. They do not see inferred workload, other calendar items, or other artist relationships.

### Per-artist notifications

- All meaningful activity
- Assignments and mentions
- Urgent only
- Muted

Muting room messages does not suppress access-change notifications or security-sensitive invitations. Email remains governed by existing Pulse preferences.

---

## 12. Responsive behavior

### Mobile

- My Work is the default Pro Team tab.
- Filter controls collapse into one Filter sheet; active filters remain visible as removable chips.
- Queue rows stack artist/context above the primary action.
- Combined Schedule defaults to agenda, not a compressed week grid.
- Permission editor is a step-by-step full-screen sheet.
- Team constellation may simplify to a horizontal people rail, followed by the authoritative list.
- Member lifecycle review is full-screen with a sticky final action.
- Team Brief becomes a linear document in the same section order.
- Team room uses the current mobile Messages layout.
- Starter-kit role cards become a single-column checklist; the content preview appears before the sticky confirmation action.

### Narrow desktop and zoom

- No horizontal page scroll at supported desktop zoom.
- Queue actions may move below the description before truncating the work title.
- Access summaries wrap as sentences; permission controls remain touch-sized.
- Electron zoom controls remain outside Team Operations content.

---

## 13. Accessibility

- Tabs use correct tablist/tab semantics and restore focus.
- Every avatar also has a visible or accessible name.
- Permission level is announced as “Tasks access: Write,” never by color.
- Starter-kit cards announce selected state, and setup confirmation names the exact item counts before creation.
- Assignment changes announce previous and new assignee.
- Urgency includes text: Overdue, Due today, Review requested.
- Drag reorder always has Move up/Move down alternatives.
- Dialogs/sheets trap focus, return focus, and describe suspension/revocation consequences.
- Realtime queue updates use a polite live region and do not steal focus.
- Message/system-event distinctions are exposed semantically.
- Reduced motion removes decorative constellation motion and animated row transitions while preserving state changes.
- High-contrast focus rings use the existing ice token.

---

## 14. Copy language

Preferred:

- Invite a Pro
- Join as Manager
- What Maya can access
- Assigned to you
- Waiting on Maya
- Request a review
- End access
- Leave this team
- Nothing is waiting on you
- This artist's Team Brief
- Set up a starting point
- Add role-based starter kits
- Start blank

Avoid:

- Resource allocation
- Workforce
- Employee
- Ticket
- Utilization
- Productivity
- Build my workspace for me
- Pro member
- Assume identity
- Impersonate

---

## 15. UX acceptance checklist

- [ ] Pro home has clear My Work, Schedule, and Roster hierarchy.
- [ ] Artist Team has People, Brief, and Waiting without duplicating Messages.
- [ ] Exact access is visible before both send and approval.
- [ ] Role changes do not silently reset custom grants.
- [ ] Assignment picker contains only eligible people.
- [ ] Every My Work row has artist context, reason, and one immediate action.
- [ ] Offboarding cannot strand work silently.
- [ ] Team Brief distinguishes derived from authored information.
- [ ] Team room always shows human sender identity.
- [ ] Availability does not reveal inferred workload.
- [ ] Starter kits are optional, previewable, combinable, private to the Pro home, and never confused with access presets.
- [ ] Adding or updating a kit does not overwrite user changes or duplicate existing starter content.
- [ ] Mobile, keyboard, zoom, screen-reader, and reduced-motion paths are specified and testable.
