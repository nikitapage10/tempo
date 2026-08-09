# TEMPO Scenes V2 — Implementation and Release Plan

*Handoff for the implementation model. Scenes V2 ships as one complete,
feature-gated release, but is built in ordered packages with a demonstrable
verification gate after each package.*

## 1. Delivery rules

- Work on a `codex/` feature branch or other user-approved non-main branch.
- Keep `NEXT_PUBLIC_SCENES_V2` off by default until the release package.
- Do not apply migrations automatically. The user runs numbered SQL files in
  order through the Supabase SQL editor.
- Never reset, truncate, or recreate production tables.
- Preserve and work around unrelated dirty-worktree changes.
- No new dependency without explicit approval.
- Follow the repository version, changelog, and living-document rules for each
  implementation package. `PRODUCT.md` must describe only enabled behavior;
  feature-flagged work is documented in the V2 specs until release.
- Visual QA is part of every package's exit gate.

## 2. Package order

### Package 0 — contract and feature boundary

**Outcome:** the implementation branch has the four Scenes V2 planning docs,
the precedence note in `SCENES-SPEC.md`, and a typed feature-flag helper.

Checks:

- Existing Scenes build and behave unchanged with the flag off.
- No public documentation claims V2 is shipped.

### Package 1 — migration 060: account personas

**Outcome:** Scenes can authorize and present members without artist profiles.

Work:

- Add `scene_personas`, migrate `scene_members` to synthetic IDs/personas, make
  artist links optional, and backfill existing data.
- Add account surface preference and deterministic post-auth landing resolution.
- Update ownership and membership security helpers to account identity.
- Add persona types, APIs, hooks, editor, and author resolution.
- Update post/comment/chat/event authorship to resolve persona first.
- Retain profile-ID compatibility wrappers.

Gate:

- Create a no-artist test account and prove it can own and participate.
- Existing artist-linked Scene renders identical names/images/history.
- RLS tests cover active, pending, invited, left, banned, and duplicate legacy profiles.

### Package 2 — standalone Scene account and Studio shells

**Outcome:** `/scene` and `/scene-studio` work independently of Origin, artist,
and space.

Work:

- Add the standalone route group and server auth layout.
- Add the Scene-first home and standalone member shell.
- Build Studio Scene switcher, overview, saved-state header, preview, and Back to TEMPO.
- Move/reuse current member, event, moderation, and settings management through
  shared modules; do not fork business logic.
- Permit Scene creation with an account persona.
- Preserve Scene invitation return paths and resolve no-artist sign-in to
  `/scene` rather than Origin.

Gate:

- A no-artist account reaches Studio without redirecting to Origin.
- The same account can use the full member Scene world outside Studio.
- Owner/moderator access differs correctly; ordinary members cannot enter.
- 1440/1024/768/390 visual review passes.

### Package 3 — migration 061 and Section builder

**Outcome:** owners can structure a flexible network.

Work:

- Add Sections, Groups, Section access, policies, APIs, and hooks.
- Seed creation templates and backfill v1 default Sections.
- Build Studio Structure: reorder, add, edit, archive, access, post policy,
  icon selection, live navigation preview.
- Add nested local Scene navigation with unread placeholders.

Gate:

- Reorder survives reload and is keyboard operable.
- Wrong-group members cannot select Section rows directly through Supabase.
- V1 feed/chat/events deep links redirect to their backfilled Sections.

### Package 4 — visual shell and identity system

**Outcome:** nested Scene world and public/member identity look intentional
before additional content types arrive.

Work:

- Build `NestedSceneShell`, responsive local rail/header/sheet, and Scene switcher.
- Replace v1 header/card with the V2 Scene hero and browse-card compositions.
- Add migration 062 appearance fields: focal X/Y, alt text, and treatment.
- Build Appearance Studio with original-image focal editor and synchronized
  desktop/mobile/card/public previews.
- Add scoped palette wash, contrast scrim, image fallback, reduced motion.

Gate:

- The supplied Owl's Nest panorama retains its selected subject at every breakpoint.
- Uploaded photography does not erase the Scene palette.
- Emblem never straddles the banner/metadata boundary.
- Bright, dark, portrait, transparent, missing, and failed images pass QA.

### Package 5 — Pulse and existing Section upgrades

**Outcome:** the default Scene experience is complete and editorial.

Work:

- Add the bounded Pulse aggregation RPC/hook and Now/Next/New layout.
- Convert v1 feed to Discussion Section rendering.
- Upgrade Events to list/calendar/agenda with Section ownership.
- Convert single chat to a Section-aware shared renderer in preparation for multi-chat.
- Upgrade People directory with persona profiles, groups, filters, List and
  optional Constellation views.
- Make welcome journey and recent/continue state part of Pulse.

Gate:

- Pulse returns only group-eligible items.
- Empty and dense fixtures have distinct, composed states.
- Feed reading measure, chat height/composer, and event agenda pass mobile QA.

### Package 6 — migrations 063/064: Library, Pages, Showcase, multi-chat

**Outcome:** all configurable Section types are functional.

Work:

- Implement collection/resource CRUD, uploads, playback/download, publish,
  schedule, and collection ordering.
- Implement validated Page blocks and preview/publish flow.
- Implement Showcase submission, approval option, frozen attachment snapshots,
  and public/member visibility.
- Add multiple Chat Sections, replies, reactions, files/images, and per-room reads.
- Add content management views in Studio.

Gate:

- Storage authorization is negative-tested as a wrong-group member and public visitor.
- Library reordering and Page publishing survive reload.
- Leaving/losing access removes every restricted chat subscription and signed URL path.

### Package 7 — migration 065: recognition and analytics

**Outcome:** optional recognition and decision-useful Studio reporting are live.

Work:

- Add badges, awards, point rules/events, meaningful active-day streaks.
- Add Recognition Studio with opt-in leaderboard and audit trail.
- Add daily aggregates and analytics RPCs for growth, activation, retention,
  posts/resources/events/chat activity, contributors, and quiet members.
- Build accessible charts using existing chart kit.

Gate:

- Replaying an event cannot duplicate points.
- Raw chat volume cannot be configured as a point rule.
- Disabled recognition writes no points and hides member-facing surfaces.
- Analytics never exposes private message bodies or catalog data.

### Package 8 — migration 066: public Scenes and invitations

**Outcome:** a Scene can operate as a discoverable or invite-only network
outside the core product.

Work:

- Add public publication state and server-only public projection.
- Build `/s/[slug]` with public Sections, hosts, events, and join/sign-in flow.
- Add hashed invitation links with expiry, groups, max uses, and revocation.
- Add Persona setup during first join.
- Extend middleware with exact public prefixes.

Gate:

- Anonymous direct table requests reveal no member-only data.
- Unpublished/unlisted Scenes return generic unavailable responses.
- Revoked/expired/exhausted invitations cannot be redeemed.
- Public imagery and metadata have correct Open Graph and accessibility behavior.

### Package 9 — discovery, search, notifications, and final Studio areas

**Outcome:** the network behaves cohesively rather than as isolated pages.

Work:

- Redesign `/scenes` for account-level identity, My Scenes, Discover, and Invites.
- Add Scene-scoped search and permitted global search results.
- Add bundled notification preferences and per-Section unread cursors.
- Complete Studio moderation, appearance, settings, ownership transfer, and archive.
- Add contextual tours for nested Scenes and Studio.

Gate:

- Search respects group access and archived/published state.
- Notification fan-out stays bounded under a 500-member activity fixture.
- Ownership transfer is atomic and leaves exactly one owner.

### Package 10 — Owl's Nest showcase

**Outcome:** one deterministic Scene demonstrates the entire release.

Work follows `SCENES-V2-DEMO-SPEC.md`.

Gate:

- Seeder dry-run lists exact writes; repeated apply produces no duplicates.
- Fixture contains every role, state, Section type, access mode, and visual state.
- No real user is added or modified.
- A direct local test-session path lands in a convincing Pulse, not an empty setup.

### Package 11 — release candidate and cutover

**Outcome:** one complete Scenes V2 release replaces the v1 presentation.

Work:

- Run all migration, security, two-account, responsive, accessibility, reduced
  motion, performance, and browser regression matrices.
- Verify compatibility redirects and missing-migration degradation.
- Turn the feature flag on for the release candidate.
- Update `PRODUCT.md`, `CHANGELOG.md`, app/package versions, search knowledge,
  setup docs, and migration run instructions.
- Keep v1 columns and compatibility functions; schedule cleanup only after telemetry.

## 3. Cross-package visual review

For every package with UI, capture or inspect:

- desktop 1440 and 1280
- tablet 1024 and 768
- mobile 430, 390, and 320
- default and custom Scene palette
- banner/no-banner/bright/portrait image
- owner, moderator, member, pending, invited, and public states
- normal and 200% zoom
- keyboard-only and reduced motion

A package does not pass because it matches a screenshot at one width.

## 4. Security regression matrix

Use at least these actors:

1. Scene owner with linked artist
2. Moderator with account-only persona
3. Ordinary member in Group A
4. Ordinary member in Group B
5. Pending requester
6. Banned former member
7. Signed-in non-member
8. Anonymous public visitor

For every new table/RPC/storage route, test the allowed case and at least one
direct denied case outside the UI. Hiding a Section or button is not a test.

## 5. Performance budgets

- Pulse: one bounded RPC plus signed-media requests; no N+1 per card.
- Initial Scene navigation: ≤ 50 Section rows and compact unread metadata.
- Feed/library pages: keyset pagination, not unbounded arrays.
- Chat: virtualize or page history before large demo/production rooms.
- Public page: return only published projection; no member roster fetch.
- Member constellation: lazy, pauses offscreen, static fallback.
- Banner: responsive dimensions and browser decoding; no original full-resolution
  image downloaded into a small browse card when a supported transform exists.

## 6. Final acceptance journey

1. Create a new account without an artist.
2. Open Scene Studio, create a writing-circle Scene, choose a template, and
   compose the banner focal point.
3. Add a private Workshop Section for one Group and a public About Page.
4. Invite a second account into that Group and approve a third request.
5. Post, poll, chat with a file, create an event, RSVP, publish a library item,
   submit a showcase item, and award a badge.
6. Verify Pulse, nested TEMPO, Studio, mobile, and public page presentations.
7. Sign in as the wrong Group and prove the Workshop content is absent through UI,
   direct API, search, notification, and storage paths.
8. Open the Owl's Nest demo and review every feature with realistic content.

## 7. Sol Medium handoff order

Before coding, the implementation model must read completely:

1. `.cursorrules`
2. `SCENES-V2-ARCHITECTURE.md`
3. `SCENES-V2-TECHNICAL-DESIGN.md`
4. `SCENES-V2-VISUAL-SPEC.md`
5. `SCENES-V2-DEMO-SPEC.md`
6. this plan
7. the v1 `SCENES-SPEC.md`, specifically its privacy/RLS/degradation lessons

Begin at Package 0/1. Do not jump directly to the new hero or demo seeder;
account personas and access helpers are the foundation for every later surface.
