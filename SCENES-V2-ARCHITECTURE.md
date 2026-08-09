# TEMPO Scenes V2 — Product Architecture

*Decision-complete product contract for the full-network Scenes release. This
document supersedes `SCENES-SPEC.md` where the two disagree. The earlier spec
remains the record of the shipped v1 implementation and its security model.*

## 1. Product definition

A **Scene** is an independent network hosted on TEMPO. It may be a music
collective, label, school, local scene, writing circle, creative cohort, fan
community, or another member-led network. A Scene is not owned by an artist or
workspace and does not require its members to be musicians.

Scenes has three connected contexts:

1. **Nested Scene world** — a signed-in TEMPO member enters a Scene from the
   core product. TEMPO's global rail remains available and a second,
   Scene-specific navigation layer appears inside the content region.
2. **Standalone Scene world** — a Scene-first account uses `/scene` and
   `/scene/[slug]` without an artist, workspace, Origin gate, or core-product
   rail. It is the complete member experience, not a reduced public preview.
3. **Scene Studio** — an account-level operating surface at `/scene-studio`
   that does not mount the active-artist or active-space providers. Owners and
   moderators use it to create, brand, structure, moderate, and analyze Scenes.

All contexts read and write the same Scene, identity, membership, content,
and permission records. Scene Studio is not a second implementation.

### Permanent privacy boundary

Membership grants access to the Scene, never to another person's private
TEMPO catalog. Tracks, projects, bounces, notes, tasks, workspaces, and private
artist data remain inaccessible unless their owner explicitly shares a frozen
attachment or public link into the Scene.

## 2. Identity model

Every membership uses a **Scene persona** owned by a TEMPO account and scoped
to one Scene. A persona has its own display name, image, short bio, location,
pronouns, and links.

- A persona may link to one published artist profile, but the link is optional.
- Creating, owning, moderating, joining, or posting in a Scene never requires
  an active artist.
- One account has at most one active membership and one persona per Scene.
- A linked artist supplies an optional starting identity; changing the artist
  later never overwrites persona fields the member has edited.
- Existing memberships are backfilled into personas from their current artist
  profiles without changing visible names, images, roles, or history.

Scene ownership belongs to the account (`owner_user_id`). `owner_profile_id`
becomes a nullable legacy compatibility field and is not used for new
authorization decisions.

## 3. Vocabulary

| Term | Meaning |
|---|---|
| **Scene** | The whole network |
| **Scene Studio** | Standalone owner/moderator operating surface |
| **Pulse** | The Scene home: now, next, and new activity |
| **Section** | A configurable destination in Scene navigation |
| **Discussion** | Feed-style posts, announcements, polls, and questions |
| **Chat** | A realtime conversation Section |
| **Library** | Collections of resources, links, files, recordings, and replays |
| **Group** | A member segment used for access and organization |
| **Persona** | A member's identity inside one Scene |
| **Owner / Moderator / Member** | Fixed permission roles |

“Section” is intentionally neutral. “Space” already means a personal TEMPO
workspace, while “channel” is too specific to chat.

## 4. Information architecture

### Account and discovery

| Route | Context | Purpose |
|---|---|---|
| `/scenes` | Core TEMPO | Your Scenes, discovery, invitations, and requests |
| `/scenes/new` | Core TEMPO | Guided creation that can hand off to Scene Studio |
| `/scene` | Standalone | Scene-first home: memberships, invitations, discovery, and recent activity |
| `/scene/[slug]` | Standalone | Full member Scene world outside the artist product |
| `/scene-studio` | Standalone | All Scenes the account owns or moderates |
| `/scene-studio/new` | Standalone | Create without an artist or workspace |

### Member Scene world

| Route | Purpose |
|---|---|
| `/scenes/[slug]` | Pulse home |
| `/scenes/[slug]/section/[sectionSlug]` | Configurable Section renderer |
| `/scenes/[slug]/people` | Directory, groups, discovery, and member profile |
| `/scenes/[slug]/search` | Scene-scoped search |
| `/scenes/[slug]/about` | About, hosts, rules, links, and public information |

Legacy `?tab=` links redirect to the matching Section and preserve `post`,
`event`, and message deep-link parameters.

Nested `/scenes/[slug]` and standalone `/scene/[slug]` use the same Section
renderers and URLs relative to their respective base. Search and notification
links choose the member's current/preferred Scene context.

### Standalone operating surface

| Route | Purpose |
|---|---|
| `/scene-studio/[slug]` | Operational overview |
| `/scene-studio/[slug]/structure` | Section builder and navigation ordering |
| `/scene-studio/[slug]/content` | Posts, pages, resources, events, and schedules |
| `/scene-studio/[slug]/people` | Members, requests, invitations, roles, and groups |
| `/scene-studio/[slug]/moderation` | Reports, removed content, bans, and audit history |
| `/scene-studio/[slug]/recognition` | Badges, points, streaks, and leaderboards |
| `/scene-studio/[slug]/analytics` | Growth, activity, retention, and content health |
| `/scene-studio/[slug]/appearance` | Identity, banner composition, palette, and previews |
| `/scene-studio/[slug]/settings` | Door, visibility, features, ownership, and archive |

### Public surface

`/s/[slug]` is the canonical public Scene address. It is server-rendered from
an explicit public projection and never exposes member-only tables through an
anonymous client. It shows the Scene identity, public About content, selected
public Sections, hosts, public events, and the appropriate join or sign-in
action. Custom domains remain a later hosting capability; the data model must
not assume the TEMPO hostname is permanent.

## 5. Scene shell

The nested member experience keeps the global TEMPO rail and adds a local
Scene rail inside the main content area. The local rail contains:

- Scene emblem, name, and Scene switcher
- Pulse
- Owner-configured Sections in saved order
- People and About
- Unread indicators scoped to each Section
- A compact Studio entry for managers

On tablet it becomes a collapsible drawer. On mobile it becomes a sticky Scene
header plus a horizontally scrollable primary destination bar; the complete
navigation opens as a sheet. No Scene destination is added to TEMPO's four-slot
mobile work navigation.

Scene Studio uses a separate full-width shell with a Scene switcher, Studio
navigation, preview action, and “Back to TEMPO” affordance. It never shows an
artist or personal workspace switcher.

The standalone member shell replaces the TEMPO rail with a compact account bar,
Scene switcher, and Scene navigation. It includes “Open TEMPO” only for members
who have an artist workspace; scene-only accounts see “Set up an artist
workspace” as an optional action that begins Origin deliberately.

## 6. Pulse home

Pulse is an editorial home, not another chronological feed. Its desktop
layout contains:

1. Scene identity hero
2. **Now** — pinned welcome, current prompt, live announcement, or active event
3. **Next** — the next two events or deadlines
4. **New** — recent discussions, resources, and member arrivals
5. Member constellation or compact member strip
6. Continue block for unfinished onboarding or recently visited Sections

Owners choose which eligible items are featured. The system supplies useful
defaults when nothing is curated. Members can dismiss onboarding but cannot
hide required rules acknowledgement.

## 7. Configurable Sections

Each Scene starts from a template, then owners may add, rename, reorder,
archive, or restrict Sections. v2 ships these Section types:

| Type | Capabilities |
|---|---|
| **Discussion** | Posts, announcements, polls, questions, comments, likes, pins, schedules |
| **Chat** | Realtime messages, replies, reactions, images, and files |
| **Events** | Calendar/list views, online or physical details, capacity, RSVPs, reminders |
| **Library** | Collections and ordered resources: article, link, file, audio, video, replay, template |
| **Showcase** | Member-submitted work cards with deliberate public/member visibility |
| **Page** | Owner-authored block page for welcomes, rules, guides, curricula, or information |

Pulse, People, Search, and About are system destinations rather than removable
Section rows. Owners may hide Search from navigation, but direct search remains
available to members.

### Templates

Creation offers four templates without locking future behavior:

- **Collective** — Pulse, Announcements, General, Chat, Events, Showcase, Resources
- **Writing circle** — Pulse, Weekly prompt, Workshop, Chat, Calendar, Reading shelf
- **School or cohort** — Pulse, Announcements, Discussion, Cohort chat, Events, Library
- **Blank Scene** — Pulse, General discussion, People, About

Templates only create initial Sections and welcome steps. They are not lasting
Scene kinds and never prevent later restructuring.

## 8. Access and roles

Permission roles remain fixed and understandable:

- **Owner** — all controls, ownership transfer, archive
- **Moderator** — people, content, events, moderation, and analytics; no ownership or destructive Scene settings
- **Member** — participates where Section access permits

Groups provide flexible access without inventing custom security roles. A
Section is visible to everyone in the Scene or to one or more Groups. A Group
may be assigned manually or by accepted invitation. Group labels are neutral
(`Writers`, `Cohort 2026`, `Mentors`) and do not grant moderation powers.

The join door remains Open, Ask to join, or Invite only. Public visibility and
join policy are separate decisions.

## 9. Recognition

Recognition is optional per Scene and off by default for new blank Scenes.

- Points come only from explicit, auditable rules selected in Studio.
- No points for raw message volume, which rewards spam.
- Initial rules may reward completing onboarding, attending an event,
  receiving a host recognition, or contributing a featured resource.
- Owners create badges; owners/moderators award manual badges.
- Streaks use meaningful active days, not app opens.
- Leaderboards can be disabled while badges remain enabled.
- Every recognition label includes a non-color cue and accessible text.

## 10. Search and notifications

Scene search covers member-visible Sections, posts, comments, events,
resources, pages, and personas. Results never cross Section access rules.

Notifications are bundled and preference-aware:

- Immediate: direct mention, reply, moderator action, invitation, approval,
  required announcement, event change
- Bundled: ordinary discussion and resource activity
- Realtime badge only: chat activity unless explicitly enabled

Unread state is tracked per membership and per Section. Global TEMPO search
finds Scenes and public/member-visible Scene destinations, while Scene search
stays inside the current network.

## 11. Scope boundaries

This release includes a full community platform but not every adjacent
business model. The following remain out of scope unless separately approved:

- Payments, subscriptions, ticket sales, or creator payouts
- Native livestream production or video hosting
- White-label mobile apps
- Automated email marketing campaigns
- A graded LMS with quizzes, certificates, or course commerce

Libraries and Pages can organize learning material without becoming an LMS.
Events may link to an external livestream or meeting.

## 12. Product acceptance criteria

- A new account can create and manage a Scene without creating an artist.
- An existing artist-linked membership looks unchanged after migration.
- The same Scene works through nested TEMPO, standalone Studio, and public routes.
- Owners can assemble a useful network from configurable Sections without code.
- Group-restricted Sections are invisible and unreadable to other members.
- No Scene action reveals private catalog data.
- Every core surface works at 320 px, keyboard-only, reduced motion, and 200% zoom.
- The populated Owl's Nest fixture demonstrates every Section type and major role/state.
