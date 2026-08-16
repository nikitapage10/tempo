# TEMPO — Team Operations Product Specification

*Status: Implemented in the shared web app and migrations 101–105. Database deployment remains additive and capability-gated by schema availability.*

**Related:** `TEAM-OPERATIONS-UX-SPEC.md` · `TEAM-OPERATIONS-TECHNICAL-DESIGN.md` · `TEAM-OPERATIONS-SECURITY-AND-PERMISSIONS.md` · `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` · `PRODUCT.md`

---

## 1. Product statement

Team Operations turns TEMPO's existing artist-team relationships into a calm, accountable way to hand work between artists and the people around them.

TEMPO already lets an artist invite a manager, agent, tour manager, label contact, assistant, or other Pro; control broad areas of access; and let that person enter the artist workspace. The next layer must answer the operational questions that access alone does not:

- What is mine to do across every artist I support?
- What has this artist delegated, and who owns the next move?
- What needs review rather than more production?
- What am I waiting on, and from whom?
- What should a newly joined Pro understand before touching the work?
- How do we coordinate without moving the whole team into a generic office tool?
- What happens to open work and access when someone leaves?

The result is not a general-purpose project-management suite. It is a music-operations layer connecting tracks, releases, tasks, dates, feedback, and the people responsible for them.

---

## 2. Product principles

1. **A person is not a permission preset.** A Pro has one identity; each artist relationship has its own role and access.
2. **Access and responsibility are separate.** Permission to edit an area does not silently assign its work.
3. **One source of truth per object.** Team Operations references existing tasks, tracks, releases, comments, decisions, calendar events, and conversations rather than copying them.
4. **The next action should be obvious.** Every My Work row offers one immediate action and one clear reason it is present.
5. **Least privilege by default.** Invitations show their exact access before acceptance. Revocation and suspension take effect immediately.
6. **Cross-artist views are private to the Pro.** One artist must never learn another artist's schedule, assignments, or catalog through a shared Pro.
7. **Human accountability without surveillance.** Record assignments, access changes, and decisions; do not add presence tracking, time policing, or hidden productivity scoring.
8. **Coordination, not another inbox.** Team rooms and notifications carry meaningful handoffs, not every autosave or background change.

---

## 3. Terminology contract

These terms are product language and must remain consistent in UI, email, documentation, database comments, and support copy.

| Term | Meaning | Not the same as |
|---|---|---|
| **Pro** | A person using TEMPO in a professional capacity around artists. The same login may also own an artist. | A permission level or employee type |
| **Team membership** | One Pro's relationship to one artist. | The Pro's global identity |
| **Industry roles** | The Pro's self-description from Passage, such as A&R, photographer, manager, or engineer. Multiple allowed. | Access rights |
| **Team role** | A relationship label and starting permission preset for one artist, such as Manager or Tour manager. | A permanent ceiling |
| **Access** | Explicit none/read/write grants by area. | Assignment or accountability |
| **Assignment** | A specific work item entrusted to one person. | Permission to view the surrounding artist workspace |
| **Team Brief** | The artist-specific orientation surface for active team members. | The public Artist profile |
| **Team room** | The private shared conversation for one artist and their active team. | Direct messages or Scene chat |
| **My Work** | A private cross-artist action queue for the signed-in person. | A shared manager dashboard visible to artists |

Avoid **“Pro member.”** Use **Pro** for the person and **team member** only when describing their relationship to a particular artist.

---

## 4. Personas and jobs

### Artist owner

- Delegate a task or review without losing visibility.
- Understand what is waiting on each person.
- Grant only the access a Pro needs.
- Orient a new teammate without assembling the same context repeatedly.
- Pause or end access safely and reassign open work.

### Pro supporting one artist

- Understand the artist, team, current priorities, and boundaries quickly.
- See work assigned to them without searching through the catalog.
- Know whether they may read, edit, upload, comment, or administer.
- Coordinate in a private team context while remaining themselves.

### Pro supporting several artists

- See one private queue and combined schedule across represented artists.
- Identify collisions without exposing one artist to another.
- Control notifications separately for each artist.
- Enter the correct artist workspace without losing their place.

### Dual-role member

- Move between their own artist, their personal Pro home, and artists they support without identity duplication.
- Send messages and complete assignments as themselves.
- Never accidentally post or speak as a managed artist.

---

## 5. Scope overview

Team Operations is delivered as seven product layers in dependency order.

### Layer A — Permission truth and terminology

1. Audit every Team access area against navigation, client behavior, and database enforcement.
2. Replace misleading controls with working grants or an explicit owner-only/unavailable state.
3. Separate industry roles, team role, and access in all invitation and profile surfaces.
4. Expand the permission vocabulary where the current Catalog grant is too broad or incomplete:
   - Catalog
   - Audio & files
   - Feedback
   - Tasks
   - Calendar
   - Releases
   - Stats
   - Performances
   - Social
   - Team administration
5. Preserve the existing role presets as editable starting points, not authority on their own.

### Layer B — Assignments and My Work

1. Assign a task to the artist owner or an active team member with sufficient access.
2. Show assignee, assigner, artist context, due date, and linked track/project.
3. Add a private My Work queue across all artists and the member's personal workspace.
4. Add Waiting on others for the artist owner.
5. Feed existing assigned comments into the same queue.
6. Add explicit review requests for a bounce, decision, feedback follow-up, or release check.
7. Notify on assignment, reassignment, due-date change, review response, and cancellation without duplicating existing Today/Pulse signals.

### Layer C — Invitation and offboarding lifecycle

1. Invitation preview includes inviter, artist, personal note, team role, exact grants, and what remains private.
2. Existing TEMPO members approve or decline in-app; new members use the established secure invite path.
3. Active members can leave a team.
4. Owners can suspend, resume, or revoke access.
5. Offboarding shows open assignments, reviews, calendar responsibilities, and room membership before confirmation.
6. Reassign or cancel open work in the same deliberate flow.
7. Keep a readable membership history without recording private creative content.

### Layer D — Artist Team Brief

1. Give every active member a stable orientation surface inside the artist workspace.
2. Reuse existing artist identity, current releases, important dates, and roster data.
3. Let authorized people add a welcome note, working norms, useful links, and pinned priorities.
4. Show what the current member may access and who owns each team responsibility.
5. Mark updated sections for the member without exposing read surveillance to the artist.

### Layer E — Artist team room

1. Create one private room per artist using TEMPO's existing messaging foundation.
2. Active members speak as themselves, never as the managed artist.
3. Support replies, reactions, search, attachments, pins, mute, archive, and realtime updates through existing message capabilities.
4. Link a message to a task, track, project, release, review request, or calendar event through safe allowlisted snapshots and deep links.
5. Allow pinned messages to be labeled as Decision, Handoff, or Reference.
6. Add only meaningful system events, such as a person joining/leaving or a review being requested.

### Layer F — Cross-artist Pro home

1. Expand Artists you work with into a private operating home rather than only a roster doorway.
2. Combine My Work, upcoming artist dates, review requests, and declared availability.
3. Show artist-colored context and fast workspace switching.
4. Detect scheduling collisions only from data the signed-in Pro may already read.
5. Add per-artist notification preferences.
6. Let Pros declare timezone, working pattern, and a simple Available/Limited/Unavailable state.
7. Share only the declared availability state with artists; never reveal other artists' names, work, or dates.

### Layer G — Role-based Pro starter kits

1. After Passage, offer an optional starter kit based on the Pro's self-selected industry roles.
2. Explain exactly what each kit adds before anything is created: home emphasis, saved views, reusable task/checklist/project templates, and an optional private sample board.
3. Let a multi-role Pro combine kits while choosing one primary home emphasis.
4. Keep all installed starter content in the Pro's personal workspace. A kit never creates artist-owned work, joins a team, or changes access.
5. Offer **Set up my workspace**, **Remind me later**, and **Start blank** with equal clarity.
6. Make kits available later from Settings so a Pro can add another role, reinstall missing defaults, or review what a kit supplied.
7. Treat installed content as ordinary user-owned content after creation: it can be edited or deleted, and product updates never overwrite those edits.

Initial curated kits:

| Kit | Home emphasis | Reusable starting material |
|---|---|---|
| Manager | My Work and this-week priorities | Weekly artist check-in, release coordination, decision follow-up, handoff checklist |
| Label / label owner | Roster and release pipeline | Release intake, metadata/rights readiness, asset delivery, campaign approval |
| Publicist | Campaigns and upcoming dates | Press asset request, announcement/embargo plan, pitch follow-up, coverage wrap-up |
| Tour manager | Schedule and day-of-show work | Show advance, travel/day sheet, venue follow-up, settlement handoff |
| Agent | Opportunities and performance calendar | Hold/offer follow-up, availability check, booking handoff, post-show follow-up |
| Assistant | Today and recurring operations | Weekly planning, approvals to chase, meeting follow-up, recurring admin checklist |
| Custom | Neutral Pro home | No content until the Pro chooses individual modules/templates |

Starter materials must be role-relevant but generic. They contain no invented artist, contact, venue, campaign, release, or deadline data.

---

## 6. Permission model

### 6.1 Areas

| Area | Read means | Write means | Always owner-only unless a later package explicitly changes it |
|---|---|---|---|
| Catalog | View spaces, track/project metadata, workflow, and allowed linked labels | Edit metadata, workflow, and relationships | Delete artist, space, track, or project |
| Audio & files | Play permitted bounces and read file metadata | Upload versions/assets and manage permitted non-destructive metadata | Delete current/pinned versions; destructive storage actions |
| Feedback | Read comments, decisions, and review state | Comment, resolve where allowed, and answer review requests | Manage public guest links unless separately granted later |
| Tasks | Read artist-space tasks | Create, edit, assign, reschedule, and complete | Bulk destructive deletion |
| Calendar | Read artist calendar | Create and update events | Destructive bulk operations |
| Releases | Read release workspaces and metadata | Edit plans, dates, credits, and readiness data | Delete release projects |
| Stats | Read streaming and custom stats | No effective write in the first Team Operations release | Personal attributes, points, achievements |
| Performances | Read performance log | Create and update performances | Delete history unless owner confirms |
| Social | Read artist-owned social planning surfaces | Reserved for an audited draft/publish workflow | Silent impersonation of the artist |
| Team | Read active roster, roles, and Team Brief | Reserved for constrained delegated administration | Change owner, edit own grants, exceed delegator's grants |

Social Write and Team Write do not ship merely because their keys exist. Until their dedicated security packages pass, the UI must label them **Owner only** rather than offering a control that does nothing.

### 6.2 Preset expectations

Presets are suggestions shown in the invitation preview. Artists may reduce or expand them before sending.

| Role preset | Typical starting shape |
|---|---|
| Manager | Broad read/write across catalog, feedback, tasks, calendar, releases, performances; stats read; audio read; team read |
| Agent | Catalog read; tasks/calendar/performances write; releases/stats read; no audio by default |
| Tour manager | Catalog/releases read; tasks/calendar/performances write; no audio or stats by default |
| Label | Catalog/audio/releases/stats read; feedback write; tasks read |
| Assistant | Catalog/tasks/calendar write; audio upload; feedback/releases/performances read |
| Custom | Nothing until the artist chooses |

The invitation summary, not the role name, is authoritative.

---

## 7. Primary flows

### 7.1 Invite a Pro with informed consent

1. Artist chooses an existing TEMPO person or an email.
2. Artist selects a team role preset.
3. TEMPO expands the preset into exact area grants.
4. Artist adjusts grants and adds an optional personal note.
5. Review states what the person can read, edit, and never access.
6. Artist sends the invitation.
7. Invitee reviews the same summary and approves or declines.
8. On approval, membership becomes active, room access is synchronized, and the Team Brief is the first workspace destination.

### 7.2 Assign a task

1. Authorized user opens a task or quick-add flow.
2. Assignee picker lists the artist owner and eligible active members only.
3. Ineligible people appear only when an explanation is useful; otherwise they are omitted.
4. Save records who assigned it and notifies the assignee.
5. The task appears in the assignee's My Work and the artist's Waiting on others.
6. Completion updates both places without creating a second task.

### 7.3 Request a review

1. Authorized user selects Request review from a version, comment thread, release workspace, or decision surface.
2. Choose an eligible person, optional due date, and short request.
3. The request appears in My Work with Listen/Review/Open as its immediate action.
4. Response writes to the existing decision/comment/release source when applicable.
5. The request closes with a link to the resulting record; it is never silently overwritten.

### 7.4 Start with an Artist Team Brief

1. A newly active member enters the artist workspace.
2. TEMPO opens the Team Brief before the normal destination.
3. The member sees artist context, current priorities, team responsibilities, links, and exact access.
4. They may continue into the workspace or open an assigned item.
5. Future visits open the normal workspace; changed brief sections receive a quiet Updated marker.

### 7.5 Suspend or remove a member

1. Owner opens the member access sheet.
2. Choose Suspend, Resume, or End access.
3. End access shows open tasks, review requests, owned calendar events, and team-room consequences.
4. Owner reassigns, cancels, or explicitly leaves each open item unassigned.
5. One transaction applies those choices and revokes access.
6. The former member disappears from active roster and room, while authored messages and historical activity remain attributed to them.

### 7.6 Work across several artists

1. Pro opens their personal home.
2. My Work shows actions grouped by urgency, not by artist first.
3. Filters narrow by artist, kind, due state, or completed history.
4. Combined schedule uses artist accents and declares conflicts without exposing them to anyone else.
5. Opening an item switches artist/space context and deep-links to the authoritative surface.
6. Back returns to the same private queue position and filters.

### 7.7 Set up a role-based Pro workspace

1. On the first opening of the personal Pro home after Passage, TEMPO asks whether the Pro wants a role-based starting point.
2. Passage roles are preselected as suggestions; the Pro may add, remove, or rename their working mix without changing their public profile or team relationships.
3. TEMPO previews the combined result, deduplicates shared templates, and asks which role should determine the initial home emphasis.
4. The Pro chooses templates only or templates plus an explicitly labeled private sample board.
5. One confirmed action installs the plan into the personal workspace and reports what was added or skipped.
6. Choosing Start blank records the choice and opens the normal empty Pro home. Remind me later defers the prompt without blocking work.
7. Later changes are additive. Installing another kit never resets layout changes, duplicates an existing starter item, or alters user-created content.

---

## 8. States and behavior

### Empty

- No memberships: explain that invited artists will appear here; show pending invitations if any.
- Memberships but no assigned work: “Nothing is waiting on you.” Keep upcoming schedule visible.
- No Team Brief content: derive artist identity, roster, access, and current work; invite the owner to add working notes.
- Team room has no messages: offer a first plain-language update, not seeded fake conversation.

### Loading

- Skeletons preserve the final hierarchy: queue, schedule, roster, brief, or conversation.
- Cross-artist queries may render successful sources while one artist source retries.

### Errors

- Preserve assignment/invite form values on failure.
- Permission failures explain whether access changed, the membership ended, or the item is no longer available without leaking hidden data.
- Partial My Work failures identify the unavailable artist only if the caller still has membership visibility.

### Realtime and concurrency

- Assignment, completion, membership, and room changes invalidate and refetch authoritative data.
- If access changes while a member is viewing an artist, the app exits that workspace calmly and clears artist-scoped caches.
- Reassignment conflicts resolve server-side; the client shows the current assignee and keeps an immutable assignment-history row.

---

## 9. Notifications and Pulse

### In-app by default

- New assignment or review request
- Reassignment away from or to the user
- Due date materially changed on assigned work
- Reply or completion on a requested review
- Invitation accepted/declined
- Access suspended/resumed/ended
- Team Brief materially updated
- Direct mention or reply in the team room

### Email eligibility

Pulse remains opt-in. High-value immediate email may include an invitation, urgent review request, or access change only when the user's existing preferences allow it. Assignment churn and room activity should normally batch or remain in-app.

### Dedupe

My Work, Today, Notifications, and Pulse must share stable group keys so one change does not appear as four separate alerts. A My Work row is an action surface; a notification is a change signal and may disappear after being opened or grouped.

---

## 10. Privacy and safety promises

- An artist cannot see which other artists a Pro supports unless the Pro publishes that relationship through existing public badges.
- An artist cannot see another artist's tasks, dates, files, room, or workload through a shared Pro.
- Declared availability is intentionally coarse; no inferred utilization percentage is shared.
- Team room members speak as their own user/profile identity.
- Membership history excludes token hashes, email provider payloads, message content, creative notes, and filenames.
- Suspension and revocation immediately remove RLS-backed access; hiding navigation is only a secondary effect.
- The Team Brief does not track or expose per-section reading behavior to the artist.
- Starter-kit choices, layouts, saved views, and sample work remain private to the Pro; choosing a role never asserts credentials or grants artist access.

---

## 11. Non-goals

- Payroll, contracts, invoices, commissions, or royalty accounting
- A public marketplace for hiring Pros
- CRM sales pipelines
- Employee monitoring, online status, time tracking, productivity scores, or leaderboards
- Kanban sprints, story points, epics, or generic office workflows
- Replacing direct messages, email, or Slack for every conversation
- Letting a Pro silently impersonate an artist on Social
- External calendar synchronization in this initiative
- Shared access across artists merely because they use the same Pro
- Automatic assignment by opaque AI
- Automatically inferring a Pro's occupation or installing content without confirmation
- Building a generic workflow marketplace or arbitrary executable template system

---

## 12. Product success criteria

### Outcome tests

- A manager supporting three artists can identify everything requiring them without entering three workspaces.
- An artist can identify delegated work, its owner, and its current state from one surface.
- An invitee can accurately describe what accepting grants before they approve.
- A newly joined Pro can understand the artist and current priorities without a separate orientation document.
- Suspending a member removes their access on the next request and active clients exit the workspace.
- Ending access cannot strand assigned work without an explicit owner choice.
- A team-room message always shows the human who sent it.
- No cross-artist information appears in an artist-owned view.
- A multi-role Pro can preview, combine, install, revisit, or decline starter kits without duplicates, access changes, or overwritten work.

### Suggested measures

- Invitation acceptance and decline rates after viewing access summary
- Time from invitation acceptance to first meaningful action
- Percentage of assignments completed or deliberately reassigned
- My Work return rate among multi-artist Pros
- Number of workspace switches required per completed Pro action
- Review-request response time, reported as neutral operations data rather than performance scoring
- Permission-denied and stale-membership error rate
- Offboarding flows completed without orphaned work
- Starter-kit preview-to-install/blank/defer choice and restore usage, measured only with role/action enums and coarse counts

---

## 13. Product acceptance checklist

- [ ] Terminology follows §3 everywhere touched.
- [ ] Every visible access control maps to tested behavior or says Owner only.
- [ ] Assignment does not grant access and access does not imply assignment.
- [ ] My Work is private, cross-artist, actionable, and deep-links safely.
- [ ] Invitation approval shows exact grants.
- [ ] Members can leave; owners can suspend/resume/end access.
- [ ] Offboarding resolves open responsibilities explicitly.
- [ ] Team Brief derives existing data instead of copying it.
- [ ] Team room reuses messaging and preserves human identity.
- [ ] Combined schedule never exposes one artist's data to another.
- [ ] Starter kits are optional, itemized before install, private to the Pro workspace, idempotent, and non-destructive toward edited/user-created content.
- [ ] Mobile, keyboard, reduced-motion, offline, desktop, and older-client states are specified and verified.
