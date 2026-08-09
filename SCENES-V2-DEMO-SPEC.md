# TEMPO Scenes V2 — Owl's Nest Demo Specification

*Deterministic development/staging fixture used to demonstrate and verify the
complete Scenes V2 release. It is inspired by the user's reference workflow,
but all branding, imagery, names, and content are original TEMPO material.*

## 1. Purpose

The demo must answer “what could this become?” immediately. It should feel like
a network that has been active for months, not a database checklist with one
row per feature.

The fixture is also the release's cross-feature integration test. Every role,
access mode, content type, unread state, onboarding state, and major responsive
composition appears somewhere in one coherent Scene.

## 2. Safety contract

Implement `scripts/seed-owls-nest-demo.js` with these hard gates:

- Default action is `--dry-run`; writes require `--apply`.
- Require `DEMO_SEED_CONFIRM=owls-nest`.
- Require an explicit allowed Supabase project reference and refuse a URL whose
  project reference does not match.
- Operate only on accounts ending in `@tempo.test` plus the configured
  `DEV_TEST_EMAIL` when that address also uses an allowed test domain.
- Never select or attach “the first real owner.”
- Never print credentials, service keys, magic links, or signed URLs.
- Do not hard-code a shared password. Create test users with random unknown
  passwords and use the local dev-session/token flow.
- Upsert by stable Scene slug, account email, Section slug, and fixture key.
- Stamp seeded rows with deterministic fixture metadata so cleanup targets
  exact rows rather than names or date ranges.
- Cleanup is a separate explicit `--remove --confirm owls-nest` operation with
  a dry-run summary. It archives the Scene by default; hard cleanup is only for
  known fixture rows in a non-production project.

Running `--apply` twice must update the same fixture and create zero duplicates.

## 3. Scene identity

| Field | Fixture |
|---|---|
| Name | The Owl's Nest |
| Slug | `owls-nest-demo` |
| Kind/template | Creative collective |
| Tagline | Make the strange thing. Bring it back to the room. |
| Location | Everywhere, after dark |
| Door | Ask to join |
| Visibility | Public landing, member-only content |
| Palette | Cool electric blue / warm copper, distinct from default Spectra |
| Recognition | Enabled; leaderboard visible to members |

Brand assets must be original. The emblem may use an abstract nocturnal eye or
concentric sound-field motif, but it must not reuse Neon Owl's logo. The banner
should show a believable creative gathering with negative space for identity
text and enough detail to prove the focal-point editor. Generate or commission
desktop and source-quality assets only during the implementation package.

Appearance fixture values include a deliberately non-centered focal point so
desktop, card, and mobile previews visibly exercise the composition system.

## 4. Test cast and roles

Reuse existing TEMPO test artists where available; link them to Scene personas
without copying profile text into every Scene field.

| Persona | Role / groups | Demo purpose |
|---|---|---|
| Configured dev test persona | Owner; Hosts | owner and Studio journeys |
| Autotune Auntie | Moderator; Hosts, Mentors | moderation, welcome, recognition |
| Plugin Priest | Moderator; Hosts | announcements and resources |
| Velvet Static | Member; Vocalists, Cohort Night | active contributor |
| DJ Soft Launch | Member; Producers, Cohort Night | events and polls |
| Bassline Barry | Member; Producers | chat/files and showcase |
| Harmony Lawsuit | Member; Vocalists | library and comments |
| Chorus Crisis | Member; Cohort Dawn | group-restricted negative case |

Add additional fixture-only account personas as needed to reach 14–18 active
members, including at least three who are not linked to artist profiles:

- a fiction writer
- a visual artist
- a community organizer

Membership states outside the active roster:

- two pending requests with notes
- one outstanding invitation assigned to Cohort Night
- one left member retained in history
- one banned fixture persona visible only in Studio moderation

No real account is used for these states.

## 5. Scene structure

Seed this navigation order:

1. Pulse (system)
2. Announcements — Discussion, moderators post
3. The Roost — Discussion, all members
4. Work in Progress — Showcase, optional approval
5. Night Chat — Chat, all members
6. Cohort Night — Chat, Cohort Night Group only
7. Gatherings — Events
8. Field Notes — Library
9. Start Here — Page
10. People (system)
11. About (system)

The owner can see one archived Section in Studio Structure to verify recovery,
but it does not appear in member navigation.

## 6. Pulse composition

Seed Pulse so the default test member sees:

- **Now:** a pinned host prompt, “What are you making before you know what it is?”
- **Next:** an upcoming hybrid listening/writing circle in five days
- **New:** one discussion, one library resource, and one showcase submission
- **Members:** six-face constellation/strip with a new-member label
- **Continue:** two of four welcome steps complete
- **Unread:** Announcements, The Roost, Night Chat, and Field Notes each differ

The owner sees a Studio attention card for two requests, one scheduled post,
one showcase item awaiting review, and one harmless fixture report.

## 7. Discussion corpus

Seed 24–32 posts spread across 90 days with realistic clusters, replies, likes,
mentions, and quiet periods. Content must read naturally and avoid repetitive
“test post” language.

Required examples:

- 3 announcements, one pinned and one scheduled
- 2 polls with different result states and one closed poll
- 3 open questions with substantive comments
- 1 image attachment
- 1 deliberately shared frozen music attachment
- 1 external writing/document link
- 2 pinned items across different Sections/filters
- one removed-and-restored harmless moderation example visible in history
- author diversity; no persona writes more than one third of posts

Suggested original topics:

- strange creative rituals that actually work
- sharing an unfinished chorus or paragraph
- finding useful constraints
- local gathering recommendations
- a monthly “small win” thread
- collaborators wanted for a cross-discipline prompt

## 8. Chat corpus

Seed 60–90 messages across Night Chat and the restricted Cohort room. Messages
span several sessions and include:

- grouped author runs
- replies
- reactions
- one image
- one small allowed file attachment
- mentions
- a moderator message
- an event link and a library-item link
- unread cursor differences by persona

Conversation should feel informal and concise. Avoid long announcement copy in
chat and avoid pretending the users shared private catalog data.

## 9. Events corpus

Seed eight events:

- three upcoming, three past, one cancelled, one at capacity
- online, physical, and hybrid locations
- different RSVP mixes and Group eligibility
- one recurring-looking series represented as separate event rows, not a hidden recurrence engine
- one event with a replay Library item after completion

Examples: listening circle, late-night writing sprint, open studio, guest Q&A,
field recording walk, and monthly show-and-tell.

## 10. Library and Pages

Field Notes contains four collections:

1. **Replays** — three event replays or external demo links
2. **Prompts & constraints** — five articles/templates
3. **Useful rooms** — four external resources with original summaries
4. **Member field notes** — four mixed audio/article/file items

Use small fixture files or safe external placeholders; do not ingest copyrighted
reference content. Every item has a kind, author/curator, date, description,
and intentional thumbnail/mark.

Start Here uses the Page block system:

- welcome heading and original banner image
- what the Scene is for
- three community expectations
- how feedback works
- link list to Announcements, Gatherings, and Field Notes
- callout reminding members that Scene access never shares private TEMPO work

## 11. Showcase corpus

Seed 10 Work in Progress items across music, writing, visual art, and event
concepts. Include:

- approved public item
- member-only item
- Group-only item
- item awaiting moderator approval
- link-only, image, audio snapshot, and text-led presentations

Showcase copy must say what kind of feedback the creator wants. Private catalog
IDs or live private metadata never appear in the fixture.

## 12. Recognition and analytics

Seed four badges:

- First Signal — completed welcome journey
- Brought It Back — contributed a featured work-in-progress item
- Held the Room — host recognition for thoughtful facilitation
- Field Recorder — contributed a featured resource

Seed auditable awards and point events across at least ten members. Keep totals
close enough that the leaderboard does not look manufactured. Include one
member with badges but no leaderboard rank when the relevant preference is off.

Backfill 90 days of daily aggregate activity consistent with the seeded
content. Studio should show plausible growth, activation, event attendance,
contributors, quiet members, and top Sections without fabricating message-body
analytics.

## 13. Welcome states

Welcome steps:

1. Shape your Owl's Nest persona
2. Read Start Here
3. Introduce yourself in The Roost
4. RSVP to a Gathering

Fixture personas cover 0/4, 2/4, 3/4, 4/4, and dismissed-complete states. One
required rules acknowledgement remains non-dismissible until checked.

## 14. Direct demo entry

Extend the local dev-session flow only after the fixture exists:

```text
/api/dev/session?next=/scenes/owls-nest-demo
```

Document the owner and ordinary-member paths without publishing credentials.
If switching between fixture accounts is needed, use an explicit local-only
account selector guarded by loopback, development mode, and an allowlist of
`@tempo.test` addresses.

## 15. Demo acceptance checklist

- Pulse looks alive on first load with no manual setup.
- Every navigation destination has meaningful content and empty states are
  tested in a separate blank fixture, not by weakening Owl's Nest.
- The panoramic banner demonstrates focal-point and palette-wash behavior.
- Desktop, tablet, mobile, reduced-motion, and public presentations are polished.
- Owner, moderator, member, wrong-Group, pending, banned, and anonymous paths work.
- Re-running the seeder creates zero duplicates and does not touch real users.
- Removing/archiving the fixture leaves unrelated Scene, account, and storage data unchanged.
