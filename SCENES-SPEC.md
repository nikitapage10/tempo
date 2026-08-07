# SCENES — feature spec

*Design and implementation spec for TEMPO's community layer. Migrations
049–054 are written; this document is the contract everything above the
database is built against. Read `.cursorrules` and `DESIGN-SYSTEM-V2.md`
first — nothing here overrides them.*

---

## 1. What a Scene is

A **Scene** is a community inside TEMPO: a label roster, a school cohort, a
production crew, a collective, a local or genre scene. It has members with
roles, topics, a forum feed, polls and open questions, events with RSVPs, and
a group chat. The people who run it get a manager dashboard.

Named "Scene" because *Space* (workspace) and *Group* (track bucket) are
already taken inside TEMPO and would collide on every screen.

### The boundary — repeat this in every review

> A Scene grants access to **the room**, never to anyone's catalog.

Two artists sharing a Scene learn nothing about each other's tracks, bounces,
notes, stages, or spaces. The only creative content that crosses is what
someone deliberately posted, and it arrives frozen in
`posts.attachment_snapshot`. No Scenes policy or helper reads `tracks`,
`spaces`, or `artists`.

This is also how the existing `PRODUCT.md` line — "TEMPO is not a full team
workspace" — stays true. That sentence must be **restated, not deleted**, when
Scenes ships:

> The catalog stays single-artist: a collaborator still sees one track and
> nothing else. Scenes is a separate community layer where many artists share
> a room — being in a Scene together gives nobody access to anyone's catalog,
> tracks, or private notes.

### Out of scope, permanently

Courses, livestreaming, payments, branded mobile apps. If a request implies
one of these, it is a different product.

---

## 2. Vocabulary (use these exact words in UI copy)

| Term | Means | Never say |
|---|---|---|
| **Scene** | The community | Community, Group, Space, Network |
| **Topic** | A board inside a Scene | Channel, Category, Space |
| **Member / Moderator / Owner** | The three roles | Admin (that's the platform operator) |
| **Join / Ask to join / Invite** | The three doors | Subscribe, Follow, Apply |
| **Post / Poll / Question / Announcement** | The four post kinds | Thread, Topic (collides) |
| **Event** | A scheduled thing with RSVPs | Meetup, Session (collides with focus sessions) |
| **Chat** | The scene's live thread | Room, Channel |

Copy stays studio-casual and plain, per `.cursorrules`: "Ask to join", "You're
in", "Nobody's posted yet", "That scene is invite only".

---

## 3. Information architecture

```
/scenes                         Browse — My scenes / Discover / Invites
/scenes/new                     Create
/scenes/[slug]                  The Scene           ?tab=feed|events|members|chat|about
/scenes/[slug]/manage           Dashboard — Overview
/scenes/[slug]/manage/members   Roster, requests, roles, bans
/scenes/[slug]/manage/topics    Topic CRUD
/scenes/[slug]/manage/events    Event CRUD + RSVP rosters
/scenes/[slug]/manage/moderation Removed posts, reports, escalation
/scenes/[slug]/manage/settings  Identity, door, palette, features, welcome
```

**Rail entry:** `Scenes` with the `Users2` lucide icon, added to **both**
`MUSIC_MAIN_NAV` and `TASKS_MAIN_NAV` in `components/app-shell.tsx`, placed
after Social. Same rule that keeps Artist/Social/Stats in both arrays: a Scene
rolls up across every space rather than belonging to one.

**Not on mobile nav.** All four mobile slots are day-to-day work surfaces
(Today / Board / Calendar / Tasks); Social and Stats aren't there either.
Scenes is reachable on mobile from search, notifications, and Social. Nothing
gives way.

### Two tab patterns, chosen deliberately

- `/scenes/[slug]` uses **URL-driven tabs** (`?tab=`), copying
  `app/(app)/settings/page.tsx` — its `TABS` array, `isTabId` guard, and
  `searchParams.get("tab")`. Required: notifications deep-link to
  `?tab=events&event=…` and `?post=…`.
- `/scenes` itself uses **state-based chips**, copying
  `app/(app)/social/social-view.tsx` (type at :32, descriptor array at :233,
  active styling at :321). Shallow browse, nothing worth deep-linking.
- `/scenes/[slug]/manage/*` uses **real route segments**, not tabs, so a
  manager can bookmark the requests queue.

---

## 4. Screens

### 4.1 `/scenes` — browse

`PageHeader` title "Scenes", subtitle "Rooms for the people you make music
with.", action: **Start a scene** (`Button`, ice).

Three chips: **My scenes** · **Discover** · **Invites** (count badge when > 0).

- **My scenes** — `SceneCard` grid. Cards show banner strip, emblem, name,
  tagline, member count, and an unread dot when `has_unread`. Sorted by
  `last_activity_at`.
- **Discover** — search + `kind` filter over `visibility in ('members','public')`
  scenes, excluding ones you're in. Before any query, show the most recently
  active scenes, so it reads as a place rather than an empty search box —
  the same instinct as Social's Discover tab.
- **Invites** — pending `status='invited'` rows with Accept / Decline.

**Network gate.** An artist whose profile is still `private` sees the
`networkGate` empty state reproduced from `social-view.tsx:248`, with one-tap
publish. Joining a Scene is a network act.

**Empty states** use `EmptyShaderPanel`. My scenes empty: "You're not in a
scene yet — find one in Discover, or start your own."

### 4.2 `/scenes/new` — create

One `.panel` form: name, slug (live availability check with a debounced
`isSceneSlugAvailable`, showing `tempo.app/scenes/<slug>`), kind, tagline,
about, the door (three radio cards: **Open** "Anyone can join" / **Ask to
join** "You approve each person" / **Invite only" "You add people yourself"),
visibility, banner + emblem via `Dropzone`, palette.

Creating writes one row. The 049 trigger seeds the owner membership, a
"General" topic, and (after 053) the chat room — the client never makes three
writes that could half-fail.

### 4.3 `/scenes/[slug]` — the Scene

**Header** (always visible, above the tabs): banner (or the scene's colour
wash), emblem, name, tagline, `kind` chip, member count, location. Right side:
the join/leave control, an overflow menu (Mute, Report, Copy link, and
**Manage** for managers).

The join control is state-driven and its label is the whole affordance:

| Your status | Door | Control |
|---|---|---|
| none | open | **Join** |
| none | request | **Ask to join** |
| none | invite | disabled **Invite only** |
| pending | — | disabled **Waiting on approval** |
| invited | — | **Accept invite** |
| active | — | overflow → **Leave scene** |
| banned | — | no control; scene reads as unavailable |

**Non-members** see the header, About, and member count — and a locked feed
with a one-line explanation. They never see posts, events, chat, or the
directory. This is enforced by RLS (`can_view_scene`), not by hiding the tabs.

**Welcome checklist** — for a member whose `welcome_steps_done` is short of
the scene's `welcome_checklist`, a dismissible `.well` above the feed with the
remaining steps. Ticking writes to their own `scene_members` row (the one
thing `update_scene_members` permits).

**Tabs:**

- **Feed** — topic rail on the left (`SceneTopicList`, "All" plus each topic,
  announcements topics marked), composer, pinned posts pinned to the top, then
  `scene_feed()` keyset pages with an infinite "Load more".
- **Events** — upcoming then past. `SceneEventCard` shows date block, title,
  location, going/interested counts, and the RSVP control.
- **Members** — directory. `FilterRow` for role + search, `Pagination`.
  Blocked pairs are filtered client-side.
- **Chat** — the group thread, reusing the existing `components/messages/*`
  thread and composer against the scene's conversation.
- **About** — long-form about, links, genres, location, owner, created date,
  rules.

A tab whose feature is switched off in `scenes.features` is not rendered.

### 4.4 Composer

`SceneComposer` wraps `components/social/feed-composer.tsx` and adds:

- a **topic picker** (defaults to the current topic; hidden when the scene has
  one topic),
- a **kind picker**: Post · Poll · Question · Announcement. Announcement only
  appears for managers. Poll opens `PollComposer` (2–10 options, multi-choice
  toggle, optional close date). Question is a post with no options — the
  helper text says answers come in the comments.
- **Schedule** (managers, questions and posts): a datetime that writes
  `scheduled_for`. A scheduled post shows a "Scheduled for …" chip in the
  author's own feed and is invisible to everyone else until it lands. That is
  enforced in the policy, not just the feed function.

Visibility is not a control here — scene posts are always `members`; the room
is the audience.

### 4.5 `/scenes/[slug]/manage` — the dashboard

A nested shell (`SceneManageShell`) modeled on
`components/admin/admin-shell.tsx`: left nav from an `items` array with
`attention` badges for **Requests** and **Reports**, driven by live counts.
Mobile collapses to a horizontal scroller — do **not** copy AdminShell's
hardcoded `grid-cols-7`, which has to be edited every time an item is added.

**Fixed layout, not the `lib/artist-layout.ts` modular system.** That system
exists because a track page or Stats is a personal reading surface arranged to
taste; a manager console is an operating surface where the queue badges must
sit where every manager expects them. The Admin console is the precedent.

**Overview** carries: pending requests, open reports, 30-day member growth and
post volume (charts from `components/artist/chart-kit.tsx`), top contributors,
quiet members (joined but never posted), upcoming events.

**Members** — roster table with role menu, Approve/Reject on pending rows,
Ban/Unban, and Invite by handle. Every destructive action goes through
`ConfirmDialog` naming the person.

**Settings** — owner only. Everything else in `manage/` is owner *or*
moderator. Archiving asks for confirmation naming the member and post counts,
and says plainly that posts are kept.

---

## 5. Palette scoping — read before styling anything

`ArtistThemeProvider` writes ice/amber onto `document.documentElement`
precisely so portalled Radix dialogs inherit them. A Scene **cannot** do the
same: it would recolour the rail, the light field, and every open dialog, and
"ice = interactive" would stop meaning one thing.

**The scene palette is scoped.** `SceneThemeScope` sets the same CSS custom
properties on a wrapper element that covers the scene header, its cards and
its charts — and nothing else. Dialogs opened from within a Scene get the
scope class applied explicitly at the portal root. Scene hues are **never**
passed to `setPaletteFromHues`.

The app-wide interaction colour stays the active artist's ice. Green still
means done, red still means blocked. A Scene tints its own surfaces; it does
not take over the app.

---

## 6. Data access

Standard three layers, no exceptions: `lib/api/scene*.ts` →
`hooks/use-scene*.ts` → `components/scenes/*`. Follow `lib/api/follows.ts` and
`hooks/use-feed.ts` exactly — named exports, `createClient()` per function,
`if (error) throw error`, explicit return types.

**Modules:** `scenes.ts` · `scene-members.ts` · `scene-topics.ts` ·
`scene-feed.ts` · `scene-polls.ts` · `scene-events.ts` · `scene-chat.ts` ·
`scene-manage.ts`.

**Query keys:** `["scenes", tab]`, `["scene", slug]`,
`["scene-feed", sceneId, topicId]`, `["scene-members", sceneId, filter]`,
`["scene-events", sceneId]`, `["scene-manage", sceneId, section]`.

**Optimistic with rollback** — `onMutate` snapshot + `onError` restore,
copying `useFeedMutations`' like/unlike — on: RSVP, poll vote, join/leave,
pin/unpin, mute, welcome-step tick. Everything else can be a plain
invalidation.

### Reuse, don't rebuild

This is the entire payoff of extending `posts` instead of adding
`scene_posts`. These work on scene posts **unchanged**:

- `lib/api/feed.ts` — `likePost`, `unlikePost`, `fetchPostComments`,
  `createPostComment`, `softDeletePost`
- `components/social/feed-post.tsx`, `components/social/post-detail.tsx`
- `components/messages/*` for chat
- `SpotlightCard`, `PageHeader`, `SectionHeader`, `HeaderMenu`, `FilterRow`,
  `Pagination`, `Dialog`, `ConfirmDialog`, `Chip`, `Dropzone`, `SignedImage`,
  `EmptyShaderPanel`, `FlareLine`, `cn()`

If you find yourself writing a second version of any of these, stop — the
schema was designed so you don't have to.

### RPCs (never write these tables directly)

`join_scene` · `respond_to_scene_join` · `invite_to_scene` ·
`set_scene_member_role` · `set_scene_member_banned` · `leave_scene` ·
`scene_feed` · `scene_remove_post` · `scene_restore_post` ·
`set_scene_post_pinned` · `cast_scene_poll_vote` · `close_scene_poll` ·
`escalate_scene_report`

`scene_members`, `scene_poll_votes` and `scene_moderation_log` have
`with check (false)` INSERT policies. That is deliberate — a policy permissive
enough for the honest case would also let a client write itself an active
membership into a request-only scene.

### Storage

Add `buildSceneMediaPath({ sceneId, kind, entityId, filename })` →
`scenes/{sceneId}/{kind}/{entityId}/{file}` to `lib/storage.ts`. **No new
bucket** — `audio` stays the only one.

Storage policies gate on `owner = auth.uid()`, so any scene media a
non-uploader must read needs `app/api/scenes/media/url/route.ts`, modeled on
`app/api/messages/attachments/url/route.ts` and re-checking `is_scene_member`
server-side. This route is mandatory, not an optimization.

---

## 7. Notifications

Deliberately sparse. A 200-member scene posting 30 times a day would write
6,000 rows a day into the shared tray and bury every catalog notification.

**Notifies:** join request (→ managers), join approved, invite, announcement,
new event, @mention (already handled by `post_mentions`), chat message
(already handled by `on_message_inserted`).

**Does not notify:** ordinary posts, comments, likes, poll votes, RSVPs.

The signal for ordinary activity is an **unread dot** derived from
`scene_members.last_read_at` vs `scenes.last_activity_at` — one indexed
comparison, zero rows written.

`entity_id` is a uuid and scene routes are slug-based, so **every scene
trigger sets `link_url` explicitly**. `lib/notifications/href.ts` gets a
`scenes` breadth plus fallback branches for `scene` / `scene_event`, but
`link_url` is what actually routes.

---

## 8. Moderation

Two tiers, and keeping them separate is what stops the platform operator
becoming the moderator of every community on TEMPO.

- **Local** — pin, unpin, remove, restore, mute, ban, role change. Done by the
  scene's own managers, recorded in `scene_moderation_log`, never seen by the
  operator.
- **Escalated** — a member's explicit report (`app/api/scenes/report`) or a
  manager's explicit escalation (`escalate_scene_report`). These write
  `content_reports` with `target_type` `scene_post`/`scene_comment`/`scene`
  and a `scene_id`, and land in the existing `/admin/reports` queue.

`/admin/reports` gains a **Scene** column so the operator can see a pattern —
one bad room — rather than a stream of unrelated posts.

---

## 9. Permission matrix

**R** = enforced by RLS or a definer RPC. **U** = UI affordance only.
Every UI-only row is cosmetic; the database is the boundary.

| Action | Owner | Mod | Member | Non-member | Enforced by |
|---|---|---|---|---|---|
| Create a scene | any networked artist | | | | `insert_scenes` **R** |
| See the scene shell | ✓ | ✓ | ✓ | ✓ if `members`/`public`, ✗ if `unlisted` or banned | `can_view_scene()` **R** |
| Read feed / posts | ✓ | ✓ | ✓ | ✗ | `select_posts` scene branch **R** |
| Post | ✓ | ✓ | ✓ unless topic is moderators-only | ✗ | `can_post_in_scene()` **R** + composer hidden **U** |
| Comment, like | ✓ | ✓ | ✓ | ✗ | `can_view_post()` **R** |
| Edit / delete own post | ✓ | ✓ | ✓ | — | `author_user_id` **R** |
| Remove / restore others' posts | ✓ | ✓ | ✗ | ✗ | `scene_remove_post` / `scene_restore_post` **R** |
| Pin / unpin | ✓ | ✓ | ✗ | ✗ | `set_scene_post_pinned` **R** |
| Announcement kind | ✓ | ✓ | ✗ | ✗ | topic `post_policy` **R** + kind picker **U** |
| Schedule a post | ✓ | ✓ | ✗ | ✗ | `select_posts` scheduled gate **R** |
| Create poll / question | ✓ | ✓ | ✓ | ✗ | `insert_scene_polls` **R** |
| Vote | ✓ | ✓ | ✓ | ✗ | `cast_scene_poll_vote` **R** |
| Close a poll | author or ✓ | author or ✓ | own only | ✗ | `close_scene_poll` **R** |
| Create / edit event | ✓ | ✓ | ✗ *(phase 2)* | ✗ | `insert_scene_events` **R** |
| RSVP | ✓ | ✓ | ✓ | ✗ | `insert_scene_event_rsvps` + capacity trigger **R** |
| Read / send chat | ✓ | ✓ | ✓ | ✗ | `is_conversation_participant()` **R** |
| Member directory | ✓ | ✓ | ✓ | ✗ | `select_scene_members` **R**; blocks filtered **U** |
| Approve / reject requests | ✓ | ✓ | ✗ | ✗ | `respond_to_scene_join` **R** |
| Invite | ✓ | ✓ | ✗ *(phase 2)* | ✗ | `invite_to_scene`, honors blocks **R** |
| Ban / unban | ✓ | ✓ | ✗ | ✗ | `set_scene_member_banned` **R** |
| Change roles / transfer ownership | ✓ | ✗ | ✗ | ✗ | `set_scene_member_role` **R** |
| Edit topics | ✓ | ✓ | ✗ | ✗ | `is_scene_manager` **R** |
| Edit settings, archive, delete | ✓ | ✗ | ✗ | ✗ | `update_scenes` / `delete_scenes` **R** |
| Leave | after transfer | ✓ | ✓ | — | `leave_scene` **R** |
| Mute, read cursor, welcome steps | ✓ | ✓ | ✓ | — | `update_scene_members` (own row) **R** |
| Report content | ✓ | ✓ | ✓ | ✓ | `app/api/scenes/report` **R** |
| Escalate to operator | ✓ | ✓ | ✗ | ✗ | `escalate_scene_report` **R** |
| Review escalations | — | — | — | — | existing `/admin/reports`, unchanged |

---

## 10. Degradation — migrations are run by hand

Six files, run manually in the Supabase SQL editor, possibly days apart. Every
new `lib/api/scene*.ts` gets an `isMissingSceneSchema(error)` guard mirroring
`lib/api/artist-profile.ts:5`, returning `[]` / `null` rather than throwing.

**Each tab degrades independently**, and the dangerous middle state is
**049 run, 050 not**: `scenes` exists so `/scenes` renders and a scene can be
created, but `posts.scene_id` does not exist, so the composer's insert fails.
`use-scene-feed` must catch that, hide the composer, and render an
`EmptyShaderPanel` reading "Scenes needs one more database update (migration
050) before posting works." — never a thrown error, never a blank screen.

| Missing | Surface that degrades |
|---|---|
| 049 | all of `/scenes` |
| 050 | Feed tab and composer |
| 051 | poll/question kinds in the composer, poll cards |
| 052 | Events tab |
| 053 | Chat tab |
| 054 | escalation control in manage/moderation |

---

## 11. Search and cross-links

- `lib/search/match.ts` — add `"scenes"` to `SearchCategory` (:12),
  `SEARCH_CATEGORY_LABELS` (:24), `CATEGORY_ORDER` (:131, after `people`), and
  a `/scenes` entry in `SEARCH_PAGES` (:58). Matcher covers name, tagline,
  genres. Only scenes the caller can see — RLS handles that, but the catalog
  fetch must not cache another account's rows.
- `lib/api/search-catalog.ts` — fetch visible scenes into the payload.
- `components/global-search.tsx` — `CATEGORY_ICONS.scenes`, filter option.
- `app/(app)/social/social-view.tsx` — a Scenes entry point, so the two
  network surfaces cross-reference.
- `lib/assistant/knowledge.ts` — a Scenes block, so the assistant can answer
  "how do I start a scene?".

---

## 12. Build order

Each package ends at something demonstrable. Do not start the next until the
current one's check passes.

1. **049** · `lib/api/scenes.ts` + hook · `/scenes` browse · `/scenes/new` ·
   rail entry · `buildSceneMediaPath`
   → *Create a scene; it appears in Discover; rail highlights on `/scenes/*`.
   Before 049 is run, `/scenes` shows the degradation panel, not an error.*
2. **Membership** · join/approve/invite/leave/roles · directory ·
   `SceneManageShell` + requests queue
   → *Second account joins an open scene instantly, requests into a
   request-scene, is refused from an invite-scene; manager approves; member
   count moves.*
3. **050** · topics · feed · composer · pin/remove
   → *Post in a scene. **Gate: `select count(*) from home_timeline(100)` per
   test account is identical before and after running 050.** A non-member's
   `select * from posts where scene_id = '…'` returns zero rows.*
4. **051** · polls · open questions · scheduled prompts · cron
   → *Vote once; counts move; a second vote in a single-choice poll replaces
   rather than duplicates; a scheduled question is invisible to a second
   account until its time.*
5. **052** · events · RSVP
   → *RSVP toggles optimistically and survives reload; `going_count` matches
   the roster; a full event refuses a new "going".*
6. **053** · chat
   → *A scene message raises the mini-inbox badge and arrives in realtime;
   leaving the scene sets `left_at` and the thread disappears.*
7. **054** · moderation · escalation · welcome checklist · search ·
   notification breadth · `knowledge.ts` · release pass
   → *Report a scene post; it lands in `/admin/reports` with its scene named.
   Global search finds a scene by name.*

---

## 13. Verification

Browser-based, against the dev server via `preview_start` — never `Bash` for
servers.

- **Two accounts.** Almost nothing here is testable with one. Use a second
  browser profile; `app/api/dev/session` exists for local session switching.
- **Test RLS from outside the UI.** After each migration, run the negative
  case in the Supabase SQL editor *as the non-member*. A hidden button is not
  a permission check.
- **The home-timeline gate.** Capture `select count(*) from
  home_timeline(100)` per test account before running 050 and after. Identical,
  or 050 is wrong — stop and fix it before going further.
- **Recursion smoke test.** After 049, `select * from scene_members` as a
  member must return rows, not error 42P17.
- **Degradation.** Before running each migration, load the corresponding tab
  and confirm the `EmptyShaderPanel`, not a thrown error.
- **Reduced motion and mobile** on every new surface.

### Before pushing (`CLAUDE.md`, enforced by `.claude/hooks/check-release-rules.sh`)

Once, covering everything since the last push:

1. `APP_VERSION` in `lib/version.ts` **and** `version` in `package.json` set to
   the same value. **They currently disagree — 0.82.0 vs 0.84.3.** A new
   feature at 0.x is a minor bump: set both to `0.85.0`.
2. `CHANGELOG.md` — dated heading, plain English for a musician, no file paths
   or component names, and an "Under the hood" line naming migrations 049–054
   as needing to be run.
3. `PRODUCT.md` — the Scenes section, plus the restated boundary sentence from
   §1 above.
