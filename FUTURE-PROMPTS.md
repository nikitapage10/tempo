# TEMPO — Next Prompt for Cursor

The prompts that built TEMPO from an empty repo up through v0.50.1 (scaffold,
track workspace, comments, guest links, milestones, stage recipes, focus
sessions, release workspace, collaboration, workspace presets, and the
Today/Board polish pass) are done and shipped — that history lives in
CHANGELOG.md and `git log`, not here. This file now holds only the one
prompt that's actually next.

Paste the whole block below into Cursor in one go.

```text
Paste this whole prompt in one go. It covers everything left in the social
layer — three migrations, three feature areas — in one continuous Cursor
session. Don't stop and wait for a new prompt at any point. Test your own
work at each checkpoint below (a "Check before continuing" line ends every
step), fix what fails, and only move to the next step once it actually
passes. I'm not going to be testing in between — you are.

Context — read before doing anything, in this order:
- .cursorrules and CLAUDE.md
- PRODUCT.md and CHANGELOG.md (the entries dated 2026-07-30, versions 0.49.0–0.50.1)
- migrations/028_artist_profiles.sql — the artist_profiles table, its security
  kernel (my_profile_ids, owns_profile, profile_is_readable, notify_profile_owner),
  and the RLS pattern (every social policy is `to authenticated`; no table this
  layer creates gets an `anon` policy)
- lib/types.ts (ArtistProfile, ArtistProfileUpdate, ProfileVisibility, ProfileLink)
- lib/api/artist-profile.ts and hooks/use-artist-profile.ts
- app/(app)/artist/page.tsx, app/(app)/artist/[handle]/page.tsx
- app/p/[handle]/page.tsx, app/p/[handle]/public-profile-view.tsx,
  app/api/p/[handle]/route.ts, lib/public-profile-server.ts — the anonymous
  public-link pattern: a service-role route, never an anon RLS policy
- lib/supabase/middleware.ts — the `/p` and `/api/p` public-route allowlist
- components/app-shell.tsx — Artist / Social / Stats are already in the rail;
  app/(app)/social/page.tsx is currently a placeholder ("Social is on its way")

Phase 1 (artist profiles) is already shipped. Do not touch artists,
artist_profiles, or any table's existing RLS policy. Every table below is
additive, across three migrations: 029 (people + follows), 030 (feed),
031 (messaging).

Standing rules established in phase 1 — keep following them everywhere below:
- No policy on a table that existed before this session may be altered.
- Every social-table policy is `to authenticated`. Anonymous access, if ever
  needed, is a server route with the service-role client, never an anon
  policy — see lib/public-profile-server.ts for the pattern.
- Any subquery inside a policy or trigger that must see rows the caller
  doesn't own goes through a `security definer` helper function (`stable`,
  `set search_path = public`, ID-only arguments, returns a boolean or the
  caller's own rows, revoked from `anon`/`public`). An RLS-filtered subquery
  inside a policy silently evaluates to "no rows" rather than raising — that
  turns a guard into a no-op, so never rely on one directly.
- Any view over an RLS-protected table must carry `with (security_invoker = on)`
  — a default view runs as its owner and bypasses RLS entirely.

How pushes work here: migrations apply automatically when pushed to main
(.github/workflows/supabase-migrations.yml). You may push more than once
along the way — e.g. right after each numbered migration file, so it
actually applies to the real database and you can verify it before building
the next layer on top of it. Mark those interim pushes
`[skip-release-check]` in the commit message (no user-facing change yet).
Do the version bump / CHANGELOG.md / PRODUCT.md pass once, on the final
push of the session, covering everything — per .cursorrules' release rules.
If you get stuck on the same failure after a couple of honest attempts
(a migration won't apply cleanly, an RLS policy you can't get to behave, a
rendering bug you can't isolate), stop where you are, describe exactly
what's broken and what you already tried, and ask me before guessing
further or pushing anything uncertain.

## Phase 2 — People, follows, the Social page, the orbit

Implement, in migrations/029_people_and_follows.sql:

1. People directory — a private CRM, NOT a shared graph. `people` is
   strictly `user_id = auth.uid()`; two accounts that both know the same
   collaborator get two independent rows. Columns: display_name,
   linked_profile_id (nullable FK to artist_profiles — resolves to a real
   TEMPO artist), linked_user_id, primary_email, roles text[], tags text[],
   notes, avatar_url, source (manual|collaborator|guest_review|
   release_credit|import), is_archived, last_interaction_at. Add
   `person_identities` (every email/handle/credit string ever seen for a
   person, with a normalized value for dedup, unique on
   (user_id, kind, value_norm)) and `person_appearances` (provenance:
   which track/project, what role, when — so the UI can say "credited as
   producer on 3 tracks"). Both scoped to user_id = auth.uid(), same as
   people.

2. Auto-seeding — write a `upsert_person(...)` security-definer
   find-or-create function plus a one-time transactional backfill at the
   tail of the migration, then AFTER INSERT triggers to keep it current
   going forward. Sources, in order: track_collaborators.invited_email,
   comments.guest_name where guest_link_id is not null, and
   release_track_metadata's featured_artists/writers/producers arrays plus
   its scalar credit columns (primary_artist, mix_engineer,
   mastering_engineer) — unnested and joined back through the owning
   project for tenancy. Do NOT rewrite release_track_metadata's free-text
   columns — they stay the source of truth; the seeder only reads them.
   Add nullable person_id columns (FK, on delete set null) to
   track_collaborators, comments, and guest_review_links so future rows
   link automatically. artists gets no new columns.

   Check before continuing: apply the migration against Supabase, then
   query `people`/`person_identities`/`person_appearances` directly and
   confirm every existing collaborator email, guest name, and release
   credit string shows up exactly once, and that re-running the backfill
   doesn't duplicate anything.

3. Follow graph — `profile_follows` (follower_profile_id,
   followee_profile_id, primary key on the pair, both directions indexed)
   and `profile_blocks`. Do NOT store a separate "connection" concept as a
   table — a mutual follow is fully derivable, so add it as a view
   `profile_connections` (self-join of profile_follows) with
   `security_invoker = on`. The block check inside the follow INSERT policy
   must go through a security-definer `is_blocked_between(a, b)` helper, not
   an inline subquery over profile_blocks (see the standing rule above for
   why). `create or replace` profile_is_readable (from migration 028) to
   additionally exclude blocked profiles — note in a comment that this
   replacement is not a no-op, since it changes behavior on an existing
   function other tables' policies already depend on.

   Check before continuing: with two Supabase accounts (or two rows you
   create by hand), confirm account B can follow account A's published
   profile, a block removes both directions from each other's follow
   reads, and profile_connections only ever returns mutual follows.

4. The Social page (app/(app)/social/page.tsx, replacing the placeholder):
   - Your network: the people directory as a filterable grid/list (by
     role/tag/source), showing which entries resolve to a linked TEMPO
     profile. A row for a linked person opens /artist/[handle]; otherwise a
     contact detail sheet.
   - Discover: search over published artist_profiles (visibility in
     ('members','public')) by display_name using the pg_trgm index already
     created in migration 028.
   - Follow/follower lists, with a working Follow/Unfollow button on
     /artist/[handle] (currently disabled there — wire it up).
   - The network orbit at the bottom of the page — see below.

   Check before continuing: load /social in the browser signed in as an
   account with at least one seeded person and one followed profile.
   Confirm the network grid, discover search, and follow/unfollow all
   actually work against real data, not just that the page renders empty.

5. The orbit constellation — components/social/network-orbit.tsx, built
   from scratch with Spectra tokens, NOT copied from any external component
   library. Three concentric rings, bottom-anchored, alternating CW/CCW
   rotation at different durations, icons counter-rotating to stay upright.
   Nodes are artist emblems drawn from the network (linked profiles first,
   then unresolved contacts) via SignedImage, falling back to
   components/artists/artist-mark.tsx's initials treatment. On hover: slow
   the rotation via a CSS custom property multiplier (ease, don't hard-stop),
   lift the hovered node, stop its own counter-rotation, and pop a
   SpotlightCard-based card (name, roles, how you know them). Click routes to
   /artist/[handle] or the contact sheet. Center: an LfWindow punched through
   to the existing Lightfield canvas (components/lightfield.tsx) with the
   active artist's emblem over it — do not add a new WebGL context or any
   new dependency (framer-motion is used in exactly one file today; this
   should not become the second — use CSS keyframes). Respect
   prefers-reduced-motion (static angles, hover still works) and pause via
   IntersectionObserver when offscreen. Use arbitrary Tailwind sizes
   (w-[27.5rem], not w-110 — this is Tailwind v3, not v4).

   Check before continuing: in the browser, hover a node (rotation eases
   down and the card pops), click through to a profile, resize to mobile
   width (no horizontal overflow), and toggle reduced-motion in devtools
   (rings go static, hover still works).

## Phase 3 — The feed

Implement, in migrations/030_feed.sql:

6. Posts — `posts` (author_profile_id, author_user_id denormalized for
   ownership checks, body text ≤5000 chars, media jsonb ≤4 entries as
   storage paths — never public URLs, optional track_id/project_id,
   visibility followers|members|public, reply_to_post_id, like_count,
   comment_count, edited_at, deleted_at). Add `post_likes`,
   `post_comments` (with parent_comment_id for one level of replies), and
   `post_mentions` (linking a post or comment to a mentioned profile).

   Attachment leak guard — a post linking a track must never let a viewer
   read `tracks`. Freeze the whitelisted display fields (title, artwork
   path, artist name) into a `attachment_snapshot jsonb` column at post
   time; the renderer reads only that snapshot and never joins tracks.
   `insert_posts`'s `with check` must require
   `track_id is null or is_track_owner(track_id)` (reuse the migration-009
   helper) so nobody can attach someone else's track.

   RLS shape: `posts` gets an inline SELECT policy (owner, or a published
   profile's post that's members/public-visible or from someone the caller
   follows) so the planner can push the predicate into an index rather than
   calling a function per row. The child tables (post_likes, post_comments,
   post_mentions) go through a single `can_view_post(uuid)` security-definer
   helper instead — inlining the same logic there would nest posts-RLS →
   profile-RLS → follow-RLS per candidate row on every comment fetch.

   Counters: like_count/comment_count are trigger-maintained columns, not
   computed on read (a feed page reads them once per row; on-read counting
   is the N+1 you're avoiding). The triggers must be `security definer` —
   the liker doesn't own the post, so a plain trigger's UPDATE would be
   silently filtered to zero rows by the existing update_posts policy and
   the counter would never move. Everything else (follower counts, unread
   badges) stays on-read count(*) — no materialized views, they go stale.

   Timeline: a `home_timeline(limit, before)` function, fan-out-on-read
   (your own posts + posts from profiles you follow, newest first, keyset
   pagination on created_at, capped at 100). Mark it `security invoker` so
   posts' own RLS still applies as defense in depth even if this function's
   logic ever drifts from the policy. Don't build a materialized fan-out
   table — at this scale it's pure overhead.

   Check before continuing: push the migration, create a couple of posts
   as two different accounts with different visibility settings, and
   confirm each account's home_timeline shows exactly what it should —
   including that a private/followers-only post from someone you don't
   follow never appears, and that liking/commenting updates the counters
   without you touching them directly.

7. Feed UI — add a feed column and composer to app/(app)/social/page.tsx
   (post text + optional single image + optional "attach a track" picker
   limited to your own tracks), a post detail view, and @mention resolution
   against artist_profiles.handle in both the composer and rendered posts.

   Check before continuing: post from one account, confirm it shows up for
   a following account and not for a non-following one when visibility is
   "followers", like and comment from a second account and watch the
   counters update, and confirm an @mention renders as a working link.

## Phase 4 — Messaging

Implement, in migrations/031_messaging.sql:

8. Conversations — `conversations` (kind direct|group, `direct_key` unique —
   the two participant profile ids sorted and joined, so there is exactly
   one direct thread per pair without partial-unique gymnastics — title for
   group only, created_by_profile_id, last_message_at, last_message_preview),
   `conversation_participants` (conversation_id, profile_id, user_id
   denormalized, role member|admin, last_read_at — read state lives here,
   NOT per message, muted, left_at, joined_at), and `messages`
   (sender_profile_id, sender_user_id, body, media jsonb, deleted_at).

   Hard requirement, not an optimization: the obvious
   `conversation_participants` policy ("readable if you're a participant")
   queries conversation_participants from within its own policy, and
   Postgres raises `42P17 infinite recursion detected in policy`. It must
   go through a security-definer `is_conversation_participant(uuid)`
   helper — there is no way around this one.

   Add `can_dm_profile(uuid)` (security definer) enforcing
   artist_profiles.accepts_dms and blocks — it reads the `profile_connections`
   view (from migration 029) from inside a definer function, where RLS on
   profile_follows is bypassed by design; note in a comment that
   profile_connections must therefore never gain a column carrying private
   data, since any definer function can read it unfiltered.

   Opening a DM is two inserts with a uniqueness race on direct_key, so wrap
   it in a `start_direct_conversation(from_profile, to_profile)`
   security-definer RPC, callable by `authenticated`, that re-checks
   `owns_profile(from_profile) and can_dm_profile(to_profile)` as its first
   statement, then `insert ... on conflict (direct_key) do nothing`.

   Check before continuing: as two accounts, start a DM, send messages both
   directions, confirm unread counts move correctly and clear on opening
   the thread, confirm a third account can't read the conversation or its
   messages at all (test with a direct PostgREST select, not just the UI),
   and confirm accepts_dms = 'nobody' actually blocks a new DM request.

9. Messaging UI — a thread list and thread view (new /messages route, or a
   tab on /social — your call, match the existing nav patterns in
   components/app-shell.tsx), composer, and an unread badge wired through
   the existing notifications tray (extended in migration 028).

   Check before continuing: full round-trip between two accounts — start a
   thread, send several messages, confirm the badge updates, leave and
   return to confirm read state persisted.

Final wrap-up, once all of the above passes:

Required per .cursorrules: bump APP_VERSION in lib/version.ts and version
in package.json together (minor bump — this is a substantial feature,
still 0.x), add plain-English CHANGELOG.md entries under today's date for
each of the three phases (mention that migrations 029–031 apply
automatically on push, no manual step), and rewrite PRODUCT.md's Social
paragraph to describe what actually shipped — replacing "Social is on its
way" entirely. Run npx tsc --noEmit and npm run build clean.

Return, at the very end:
- the exact RLS policies you wrote for every new table across all three
  migrations, so they can be reviewed against the standing rules above
- a two-account test plan covering people, follows, blocks, feed
  visibility, and the DM permission matrix — what account B should and
  should not be able to see or do against account A's data
- a screenshot-driven walkthrough of the Social page, the orbit's hover
  behavior, a feed post round-trip, and a messaging round-trip
```
