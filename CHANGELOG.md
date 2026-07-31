# CHANGELOG

Plain-English history of what changed in TEMPO, newest first.

## 2026-07-31

- Added (v0.69.0): Origin now opens with sound. It waits on a still frame while
  a few lines surface — "Something is listening", "A pulse, finding its
  footing" — and starts when you tap. That tap is also what lets the film play
  with its audio; browsers won't allow sound before you've touched the page.
- Changed (v0.69.0): the clips now genuinely dissolve into one another instead
  of one stopping and the next starting. The outgoing shot keeps moving
  underneath the incoming one for the whole blend, and the sound crosses with
  it.
- Changed (v0.69.0): the panels now sit to the right of the screen rather than
  the middle, so they stop covering the subject of the footage, and they fade
  in properly instead of appearing all at once.
- Changed (v0.69.0): "Bring your music in" is now a chapter of the Origin story
  rather than somewhere you get sent afterwards — you choose there, and Enter
  TEMPO takes you where you chose.
- Changed (v0.69.0): the closing of Origin has a proper Enter TEMPO button, and
  your story now always seeds your private profile rather than asking — it only
  ever fills blanks and still never publishes anything.
- Changed (v0.69.0): your artist name is now required rather than skippable —
  everything after it is built from it.
- Fixed (v0.69.0): "Replay introduction" in Settings did nothing. It now
  replays the whole thing from the first frame.

- Fixed (v0.68.0): the story at the end of Origin didn't respond to scrolling,
  which also meant "Enter TEMPO" was out of reach and there was no way to
  finish. Scrolling now moves through your story as intended, and there's a
  quiet "Skip to the end" button visible the whole way through so the way out
  is never something you have to scroll to find.
- Changed (v0.68.0): Origin flows better between steps. The name box, the
  speaking panel, and the review all now fade in over the last moment of the
  film before them, so they're already settled by the time the scene lands —
  instead of the film stopping, a beat of nothing, then a box appearing.
- Fixed (v0.68.0): "Back" from the story now returns you to the review step
  rather than doing nothing.

- Fixed (v0.67.1): Origin's videos never appeared — you'd get a still frame or
  a black screen instead of the film. A mistake in the handoff between clips
  meant TEMPO waited forever for the next video to be ready and never showed
  it. The film now plays.

- Added (v0.67.0): **Origin** — TEMPO's new welcome for a first-time artist.
  Instead of landing straight in an empty workspace, the app opens with a short
  film: it asks who you are, then asks you to talk for half a minute about what
  you make and why. You can speak it or type it, whichever you prefer. TEMPO
  listens and writes back a first draft of your story — what you seem to
  promise a listener, what keeps pulling you back, and the chapter you're
  opening right now. Every word of it is yours to edit, rewrite, or throw out,
  and you can ask for a different reading without losing the one you have. It
  ends with your story unfolding as you scroll, and then TEMPO opens up around
  you. Nothing from Origin is published, and nothing is shared — it's yours,
  privately, and you can revisit or rewrite it any time from Settings.
- Added (v0.67.0): if you'd like, Origin can quietly use what you wrote as the
  start of your private artist profile. It's off unless you tick it, it only
  fills in blanks — it never overwrites anything you've already written — and
  it never makes your profile public or turns Social on.
- Changed (v0.67.0): Origin only ever appears for a brand-new artist. If you
  already use TEMPO, nothing changes and you'll never be pushed into it, and
  switching between your artists won't drop you into onboarding either.
- Under the hood: **run migration `042_artist_origins.sql` in Supabase before
  this reaches anyone.** Until it's run, TEMPO behaves exactly as it does today
  — new sign-ups go straight to Bring Your Music In, as before.

- Changed (v0.66.3): the boot video looks sharper. It now plays at its full
  original resolution instead of a shrunken copy — and it actually got
  *smaller* to download, not bigger. A fine film grain sits over the top,
  which gives the soft light something crisp to sit against and clears up
  the faint banding you get in the darker areas.

- Fixed (v0.66.2): the boot video plays smoothly now. It was being pushed
  through the same graphics pipeline that draws the moving light in the app,
  frame by frame, while that light kept drawing away behind it — the two were
  fighting for the graphics card and the video lost, unevenly. The video now
  plays directly, the background light pauses while it's on screen, and the
  graphics effect only switches on for the dissolve at the very end.

- Fixed (v0.66.1): the boot moment is smooth now. The video starts loading
  quietly while you're on the sign-in screen, so it's ready to go the moment
  you're through, and it waits until it actually has enough to play instead
  of stuttering through the opening. You also no longer catch a glimpse of
  the app for a split second before the video takes over.

- Changed (v0.66.0): the boot video now plays *after* you sign in, not before.
  The sign-in screen is plain again, and the video runs as the loading screen
  while your workspace loads behind it. The ending is a true dissolve now —
  the picture breaks into prismatic streaks and fades through into the app
  instead of cutting. The **Skip** button also shows up sooner and is easier
  to see.

- Added (v0.65.0): the boot moment has a new look. Opening TEMPO (or the
  sign-in screen) now plays a short video — a spark igniting into the app's
  ice/white/amber light — with the TEMPO wordmark revealing letter by letter
  over it, before the whole frame dissolves into the app. It plays once per
  day per device rather than every time you open a tab, and it's skipped
  automatically if you prefer reduced motion (click or press any key to
  jump straight past it).

- Fixed (v0.64.1): re-running the messaging inbox database update no longer
  stops with an error partway through. It now skips work that's already been
  done, like the other updates do.

- Under the hood (v0.64.1): if a database update run stopped at
  `039_messaging_inbox.sql`, run it again — 040 and 041 come after it and
  won't have been applied yet.

- Added (v0.64.0): you can start a message with anyone. **New message** in both
  the message menu and the Messages page finds any artist on the network by name
  or handle and opens the conversation — no need to go to their profile first.
  If someone has direct messages turned off, TEMPO says so instead of failing.

- Added (v0.64.0): search now covers your messages. Artist conversations and
  TEMPO Support tickets — active and archived — are searchable by who they're
  with and by what was said in them, with their own **Messages** filter.
  Opening an archived result takes you straight to it in Archived.

- Changed (v0.64.0): search forgives spelling. A typo, or one wrong word in a
  title, still finds what you meant — "Fade from Dust" finds *Fade to Dust*.
  When the nearest thing is a real stretch, search says there's no exact match
  and offers it as a "did you mean" you can click.

- Changed (v0.64.0): the profile photo on artist headers now fills the banner
  top to bottom, sits closer to your name, and feathers into the artwork on
  every side instead of reading as a photo box dropped on top of it.

- Added (v0.63.3): direct and TEMPO Support messages now arrive through a
  private realtime notification stream, immediately refreshing the mini-inbox,
  full conversation, unread counts, notification center, and Admin Support.
  A timed refresh remains as a reconnect fallback, so no manual refresh is
  needed.

- Changed (v0.63.3): selecting a conversation in the top-right message menu
  now replaces the inbox list with that conversation's focused quick-reply
  view. A Back control returns to the compact inbox.

- Changed (v0.63.2): profile-header images are larger and blend into their
  banners with a broad, soft artist-colour halo. The short decorative line
  beneath the image has been removed.

- Changed (v0.63.1): docs and assistant copy now say clearly that a **project is
  not one track** (and a track does not need a project). Projects are work
  containers you define; album / EP / playlist buckets stay on Tracks as groups.

- Added (v0.63.0): on Tracks, you can split songs into named **groups** — an
  album, EP, playlist, or whatever bucket you need. Create a group, drag tracks
  in or out, rename or reorder groups, and remove a group without deleting the
  tracks (they land back in Ungrouped). Groups are only for organizing the
  Tracks list; they are not projects.

- Under the hood (v0.63.0): run migration `041_track_groups.sql` in Supabase
  before using groups.

- Fixed (v0.62.7): generated artist avatars now stay perfectly square inside
  circular map pins, and profile-header images keep their full circular edge
  instead of being stretched or clipped by overlapping size effects.

- Changed (v0.62.6): default artist avatars keep their initials but now use a
  restrained circular signal-disc design with subtle depth and palette-colour
  orbit accents instead of the glossy horizontal stripe.

## 2026-07-30

- Fixed (v0.62.5): re-running the calendar planning database update no longer
  fails when those planning rules were already applied once.

- Under the hood (v0.62.5): re-run migration `038_calendar_planning.sql` (and
  anything after it that didn’t finish) in Supabase / your migration runner.

- Added (v0.62.3): the Admin navigation now shows live count badges beside
  Support and Reports whenever either queue has open work. Counts refresh
  automatically and also update after an admin takes action.

- Changed (v0.62.4): Today now uses a simple sun icon without the upward
  arrow, while Calendar keeps its separate calendar icon.

- Changed (v0.62.4): artist profiles with no uploaded profile image now leave
  that space empty. Elsewhere, the old thin-bar placeholder is replaced by a
  readable artist-coloured monogram in feeds, messages, lists, and the globe.

- Changed (v0.62.4): profile-header images now sit to the right of the artist
  name and feather into the banner with a soft artist-colour glow and a fine
  Spectra light edge, replacing the plain circular-avatar treatment.

- Added (v0.62.0): Notifications, Messages, and Search now share the global
  top-right toolbar. Messages has its own unread badge and opens a mini-inbox
  with recent artist and TEMPO Support threads, quick reply, and a link into
  the full conversation. The TEMPO rail wordmark is larger now that the bell
  no longer occupies its header.

- Added (v0.62.0): direct and support messages now support live dictation,
  recorded transcription fallback, and up to four private image, audio,
  document, or archive attachments (10 MB each). Attachments use short-lived
  links checked against both thread membership and the original sender.

- Added (v0.62.0): the full Messages page and Admin Support inbox can archive
  and restore conversations, show unread state, and let a sender delete their
  own individual replies. A new reply automatically returns an archived thread
  to the recipient's inbox.

- Under the hood (v0.62.0): run `039_messaging_inbox.sql` after migration 036
  before using unread, archive, attachment, or support-message deletion features.

- Changed (v0.61.0): artist identity images can now be either a profile photo
  or an emblem. They appear as larger, circular avatars in the feed, on artist
  profiles, in messages, and around the Social globe, with a colour-mark
  fallback when an artist has not uploaded one.

- Changed (v0.61.0): the assistant now uses TEMPO's compact equalizer mark
  instead of borrowing the active artist's profile image.

- Added (v0.61.0): Calendar is now a complete creative planning workspace.
  It adds a six-stage Timeline, drag and bulk rescheduling, unscheduled-work
  suggestions, search and saved presets, workload and participant-conflict
  signals, natural-language scheduling, configurable week layout, and
  release-plan generation.

- Added (v0.61.0): custom events now support milestones and dependencies,
  recurrence, in-app reminders, participants, completion, links and briefs,
  comments, activity history, duplication, and CSV or print-to-PDF export.
  External calendar synchronization remains intentionally excluded.

- Changed (v0.61.0): Calendar now uses the calendar glyph previously shown
  for Today; Today uses a sunrise glyph so the two destinations are distinct.

- Under the hood (v0.61.0): run migration `038_calendar_planning.sql` after
  migration 037 to enable the expanded planning metadata and reminder
  delivery. Core Calendar events retain a migration-safe fallback.

- Changed (v0.60.0): the Admin overview is now an operating dashboard rather
  than a flat set of totals. It highlights work needing attention, 30-day
  member activation, growth, membership health, storage, and direct shortcuts
  into the support and moderation queues.

- Changed (v0.60.0): Usage analytics now has 7-, 30-, and 90-day views, richer
  metric cards, real area/line charts, useful zero-activity states, and a
  creation snapshot for tracks, projects, and AI users.

- Added (v0.60.0): Admins can reply to a support ticket as **TEMPO Support**.
  The member receives a private, two-way support conversation inside Messages,
  even if they have not joined the artist network. Member replies automatically
  reopen resolved tickets.

- Fixed (v0.60.0): invitation delivery now preserves Resend's safe rejection
  reason and shows deployment/sender health in Admin Invites, distinguishing an
  invalid key, testing-mode restriction, and an unverified sender domain.

- Under the hood (v0.60.0): run migration
  `036_support_conversations.sql` before using two-way support replies.

- Added (v0.59.0): **Calendar** is now its own desktop and mobile tab. It
  combines task due dates, track targets and next moves, project deadlines,
  releases, and pitching deadlines in Month and Agenda views. You can filter
  sources, switch between the active space and every space for the artist,
  and open any derived item at its real editor. Calendar event pills and
  agenda rows use TEMPO's cursor-following edge glow.

- Added (v0.59.0): create all-day or timed Calendar events for studio
  sessions, meetings, content, shows, personal plans, and other work, with an
  optional location, description, and related track or project.

- Under the hood (v0.59.0): run migration `037_calendar_events.sql` in
  Supabase to enable custom-event creation. Existing TEMPO deadlines still
  appear before the migration is applied.

- Added (v0.59.0): **Report a problem** now sits beside Settings and inside
  the Settings page. Members can send a bug, ask for help, or share feedback;
  the report includes only what they type, a privacy-safe page label, and basic
  browser information. The Admin console has a Support queue for triage,
  private notes, resolving, and reopening reports.

- Added (v0.59.0): the TEMPO assistant can turn a clearly described bug or
  help request into a support report. It shows the proposed report first and
  sends it only after the member confirms.

- Added (v0.59.0): members can report a post directly from the Social feed or
  report another artist from their published profile. Those reports enter the
  existing Admin moderation queue with only the specific public post or profile
  attached—never either person’s private workspace.

- Under the hood (v0.59.0): run migration `035_support_reports.sql` in
  Supabase before using product support reports.

- Changed (v0.58.1): the Social globe is a bit more willing to show nearby
  pins at full zoom-out — places like London, Amsterdam, and Berlin can sit
  together with a little overlap instead of collapsing to a single face.

- Added (v0.58.0): you can scroll to zoom the Social globe. When a bunch of
  people are piled into the same part of the world, only some pins show at
  first — zoom in and more appear as they get room to separate. Dispersed
  people still show together. Drag to spin, and tap Reset when you’re zoomed
  in to jump back out.

- Added (v0.57.0): the Admin console now has a dedicated usage analytics
  screen showing 90-day trends for assistant requests, storage growth,
  uploads, and focus time, plus current storage and useful 30-day totals.
  These are aggregate measurements only—admins still cannot open anyone’s
  tracks, projects, notes, audio, or other creative work.

- Added (v0.57.0): entering an email when creating a program invite now sends
  a dark, TEMPO-branded invitation containing that person’s unique code and
  one-click signup link. The Invites screen shows delivery status and supports
  sending the invitation again when needed.

- Under the hood (v0.57.0): run migration `034_admin_invite_delivery.sql`,
  then add `RESEND_API_KEY` and a verified `INVITE_FROM_EMAIL` sender in
  Vercel before sending invitation emails.

- Fixed (v0.56.4): you show up on your own Social globe now — if your Artist
  location is set (like Denver), your pin is there with everyone else’s.

- Changed (v0.56.3): Social globe shows a little more of the lower half, with
  a gentler fade into the page, and the atmosphere glow no longer clips flat
  against the top edge.

- Changed (v0.56.2): the Social globe is back to showing mostly the upper
  half of the earth, with a longer fade into the page at the bottom, and no
  ring — black or white — around the planet’s edge.

- Changed (v0.56.1): the Social globe is larger, and the hard black ring
  between the planet and its glow is gone — the edge softens into the
  atmosphere instead.

- Added (v0.56.0): a private Admin console for running TEMPO’s invited
  program. Platform admins can see member accounts and aggregate usage,
  suspend or reactivate access, remove an account with strong confirmation,
  issue and revoke individual invite links, review reported public content,
  and inspect a permanent log of privileged changes. Members’ tracks,
  projects, audio, lyrics, notes, feedback, comments, sessions, messages, and
  private profile content are deliberately excluded.

- Changed (v0.56.0): signup links can now carry a unique invite code, and a
  successful signup records which invite was used. The original shared invite
  code still works during the transition.

- Under the hood (v0.56.0): run migration `033_admin_console.sql` in Supabase,
  then set `ADMIN_EMAILS` in Vercel to the comma-separated email addresses that
  should be allowed into the Admin console.

- Changed (v0.55.0): the Social page has been rebuilt around three tabs —
  **Top 8**, **Follows**, and **Discover**. A spinning globe now sits under
  the tabs at all times, showing where the people you're connected to
  actually are in the world. Hover a face to slow the globe down and see who
  they are and where; click to open their profile. You can drag the globe to
  spin it yourself, and it's painted in your own artist colors, with the
  color washing slowly across the continents.

- Added (v0.55.0): **Top 8** — pick up to eight people to pin at the top of
  Social for quick access, the way you'd have on an old profile page. Add
  from anyone you follow or any contact linked to a TEMPO profile.

- Changed (v0.55.0): the feed moved to its own column down the right-hand
  side of Social and fades out at the bottom instead of taking over the
  middle of the page. The "Network" tab is gone — your contacts now surface
  through Top 8, Follows, and Discover instead.

- Changed (v0.55.0): **Discover** now shows artists you've recently worked
  with before you've typed anything, so it's a place to reconnect rather than
  just an empty search box.

- Changed (v0.55.0): posting to the feed starts as a single line. Click it and
  the rest — image, track, and who can see it — opens up, so the composer
  stays out of the way until you're actually writing.

- Changed (v0.55.0): setting your **location** on the Artist page now suggests
  cities as you type — type "den" and pick "Denver, CO, USA". That's what
  places you on the Social globe, so filling it in is how you show up there.

- Fixed (v0.55.0): artist logos were blowing up to enormous size in the feed,
  in Messages, and anywhere else they appeared without a fixed size — they
  now stay the size they're meant to be.

- Added (v0.54.0): search now covers your feed, too — posts from you and the
  people you follow show up alongside tracks, projects, and everything else.
  Pick one from the filter bar to jump straight to it and open the
  conversation.

- Changed (v0.53.9): the thin animated light strip along the very top of the
  app is smaller now — more of a subtle accent than a bold band.

- Fixed (v0.53.8): the search bar's glow was bleeding down onto the row of
  buttons below it on Board and Projects (Sort/Filter/Stages/Track), making
  things look blurry and crowded. It now sits with proper clearance on every
  screen.
- Changed (v0.53.7): search bar redone — the glowing border now matches
  TEMPO's own ice/amber accent colors instead of the leftover purple/pink,
  the bar is sized down closer to the rest of the header, and the fade that
  was washing out your typed text is gone. Hovering now speeds the glow up
  smoothly (no more visible jump) and blooms a soft halo around the whole
  bar; it settles back down the instant your mouse leaves instead of
  staying sped up.
- Changed (v0.53.6): search placeholder reads “Search tracks, artists,
  details…” instead of calling out BPM.
- Changed (v0.53.5): search bar brings back the colorful glowing border
  (purple / pink conic layers), with slower, smoother motion on hover and
  focus.
- Changed (v0.53.4): a little less space above the search bar, a little more
  below it.
- Changed (v0.53.3): search glow follows your cursor the same smooth way
  track cards do (ice → white → amber), instead of the fast spinning border.
- Fixed (v0.53.2): search lines up with the right edge of the page content
  (same column as Today/Board), instead of floating short of it.
- Changed (v0.53.1): search sits flush on the right with the rest of the page,
  and the “⌘K to focus” line under it is gone.
- Added (v0.53.0): a glowing **search** bar at the top of every screen. Type
  and results pop up grouped — tracks (including BPM, key, tags, artist name,
  genre, next move), projects, tasks, people from your network, board notes,
  stages, spaces, and quick jumps to pages like Board or Stats. The filter
  button narrows to one category; arrow keys and Enter pick a result; ⌘K / Ctrl+K
  focuses the bar. Searching a track in another space switches you there when
  you open it.
- Changed (v0.52.0): socializing is optional. On **Artist** you toggle
  **Off the network** / **On the network** — off means private (nobody can
  find or follow you); on lets you pick TEMPO members or a public link.
  **Social** still shows your private contact book and orbit when you're
  off; Feed, Follows, Discover, and Messages ask you to join first (one
  tap), with a link back to network settings.
- Fixed (v0.51.1): emblems on the Social orbit actually show and sit on the
  rings — the spin animation was shoving them off their spots, and the
  constellation is centered in the panel so you can see them.
- Added (v0.51.0): **Social** is live — your private network of collaborators,
  guest reviewers and release credits, searchable and filterable, with a link
  through to anyone who already has a TEMPO artist profile.
- Added (v0.51.0): **Follow / unfollow** other TEMPO artists from their
  profile, with following and follower lists on Social. Blocking someone
  clears the follow both ways.
- Added (v0.51.0): a **Discover** search for published artist profiles by
  name, and a constellation **orbit** at the bottom of Social that draws
  people from your network (hover a node for who they are and how you know
  them; click through to their profile or contact card).
- Added (v0.51.0): a **feed** on Social — post an update (with an optional
  image or one of your own tracks), @mention someone by their handle, like
  and comment. Visibility can be followers-only, TEMPO members, or public.
  Your home feed shows your posts plus posts from people you follow.
- Added (v0.51.0): **direct messages** — start a thread from someone's
  profile (respecting their "who can message you" setting), send messages
  both ways, and see unread counts clear when you open the thread.
  Messages lives at its own screen, reachable from Social.
- Under the hood (v0.51.0): migrations 029–031 apply automatically on push —
  no manual step in the Supabase SQL editor.

- Fixed (v0.50.1): your artist emblem on the Artist profile page was showing
  inside a boxed, opaque background and getting cropped to a square. It now
  shows at its own true shape and transparency, sitting right next to your
  name at the same height — with your handle and tagline lined up flush
  underneath the name, not the emblem.
- Added (v0.50.0): the **Artist** page is now a real editable profile — a
  tagline, bio, backstory, location, pronouns, genres, roles, and up to 12
  links, plus who's allowed to message you. Nothing here is visible to
  anyone else until you choose to publish it.
- Added (v0.50.0): **visibility controls** for your profile — keep it
  **Private** (just you), open it to **TEMPO members** (anyone signed in can
  look you up), or go **Public link**, which also makes it reachable by
  anyone with the link, no TEMPO account needed.
- Added (v0.50.0): a **handle** — a short, shareable @name for your public
  link and future @mentions. Your artist name stays the prominent thing
  everywhere in TEMPO; the handle is just the address.
- Added (v0.50.0): visiting another TEMPO artist's profile (once they've
  published one) now shows their bio, backstory, genres, roles and links —
  reachable once the network view lands.
- Under the hood (v0.50.0): **run migration 028 in Supabase** before any of
  this works. Until then, the Artist page shows its old "nothing here yet"
  placeholder and nothing breaks.

- Changed (v0.49.0): the old **Artist** page — banner, headline numbers, the
  year in bounces, pipeline, your sound, and everything else it tracked — is
  still exactly where it was, just renamed **Stats** and moved to its own spot
  in the left rail. Nothing about it changed except the name and location.
- Added (v0.49.0): **Artist** is now your public-facing profile page — the
  start of a page other people will eventually be able to look up: your name,
  your branding, and soon a bio and backstory. It's a placeholder today; the
  editable bio, links and visibility controls are coming next.
- Added (v0.49.0): a new **Social** tab in the left rail — a first look at
  what's coming: your network of collaborators and other artists on TEMPO,
  with follows and a feed to follow in later updates.



- Fixed (v0.48.0): the Artist page's **layout arrangement now follows your account**, not just the browser you set it up in. It used to be saved only to that one device, so a custom module you built at home wouldn't show up when you checked the site from your phone or another computer — same data, different arrangement. Now "Edit layout" is the same wherever you sign in. An arrangement already saved on a device carries over automatically the first time that browser loads the page after this update.
- Added (v0.48.0): each stat inside a **custom module** now draws a proper filled area chart once it has two or more logged readings — a date under each end, a dot on every reading — instead of just a list of numbers.
- Added (v0.47.0): **layout templates** for the Artist page. Open "Edit layout" and pick a starting point — **Overview** (everything), **Minimal** (just the shape of things), **Statistics** (numbers first), or **Platforms** (Spotify/SoundCloud/Apple Music lead) — then rearrange freely from there. Your own arrangement is never touched until you pick one.
- Added (v0.47.0): **custom stat modules** on the Artist page — build your own tracker for anything TEMPO doesn't already measure: sync placements, merch sold, radio spins, an Instagram follower count, whatever matters to you. Create a module from "Edit layout", then add as many named stats as you like (with an optional unit) and log a reading for any date right from the card. Log as often as your own updates happen — each reading is kept, so a stat with two or more readings gets its own trend line. Made a typo? Each stat shows its recent readings with a one-tap undo. Rename or delete a whole module from its own header.
- Under the hood (v0.47.0): database migrations now apply automatically when this project is pushed, instead of needing to be pasted into Supabase by hand.

- Added (v0.46.0): **Spotify, SoundCloud and Apple Music sections** on the Artist page. Paste your profile link once and each one starts reporting:
  - **SoundCloud** — plays, followers, likes and reposts, plus your most-played tracks.
  - **Spotify** — your releases as Spotify lists them.
  - **Apple Music** — your releases as Apple lists them.
  Each section says plainly what it can't show. SoundCloud is the only one of the three still giving apps real numbers: Spotify removed follower counts, popularity and top tracks from its API in February 2026, and Apple's statistics need a paid developer membership — so both of those are catalog listings only. TEMPO never guesses at the missing numbers, and stream counts were never available outside Spotify for Artists anyway.
- Added (v0.46.0): because SoundCloud only ever hands over *today's* totals and no history, TEMPO records them once a day and draws the trend itself. The section shows a flat number on day one and a line from day two, so the curve builds as you go.
- Under the hood (v0.46.0): **run migration 024 in Supabase** before this works, and add the Spotify and SoundCloud keys to your environment. If you skip either, the sections just say they aren't linked — nothing breaks. Apple Music needs no keys at all.

- Added (v0.45.0): a new **Artist** page — everything under one artist name, across every space at once. It opens on your banner, logo and a headline row (tracks, bounces, in progress, released, focus time), then:
  - **The year in bounces** — twelve months of bounces uploaded against tracks started, so a year of work is visible in one glance.
  - **Pipeline** — where tracks sit in each space's stages, one bar per space so several spaces stay readable.
  - **Spaces** — all of an artist's spaces side by side with their own counts and when each was last touched; tap one to switch to it.
  - **Your sound** — the shape of your tempos, the keys you write in most, your genres and track types.
  - **Work rhythm** — when you actually work, by day and hour, plus your busiest day, busiest hour and how many weeks in a row you've kept going.
  - **Longest in progress** — the oldest unfinished tracks and how long they've sat in their current stage.
  - **Releases** and **Feedback received** — countdowns to what's coming, what's already out, and how much feedback has come in from guests versus your own notes.
- Added (v0.45.0): the Artist page is **modular** like a track workspace. "Edit layout" in the top-right of the banner lets you drag sections between the two columns, reorder them, drop one onto another to combine them into tabs, and hide what you don't want (hidden sections stay one click away). Reset puts it back. Your arrangement is remembered per artist, on that device.
- Added (v0.45.0): **Artist** is now in the left rail, and "Artist overview" sits in the artist dropdown.
- Changed (v0.45.0): the charts on the Artist page follow the artist's own Cool / Warm colours, adjusted so large filled shapes stay readable on the dark background.
- Added (v0.45.0): your **emblem** now shows on the browser tab, on the assistant's round button, and beside the assistant's replies — so which artist you're working in reads at a glance, even across several tabs. Without an emblem uploaded you get your artist's own colour mark instead, and the tab keeps TEMPO's icon.

## 2026-07-29

- Removed (v0.44.3): all special effects on the Today logo — it's just your logo again. Also, if you haven't uploaded an emblem, the artist switcher shows only the name (no placeholder mark).
- Changed (v0.44.2): the Today logo cutout is a bit more visible — still see-through to the lightfield, just easier to read the letters.
- Fixed (v0.44.1): the Today logo cutout actually punches through the banner now (the first try used a CSS blend mode browsers don’t support, so the logo still looked solid).
- Changed (v0.44.0): the Today logo is a cutout — the letter shapes punch through the banner so the moving lightfield shows through them (the line/flare effect is gone).
- Changed (v0.43.9): the Today logo effect is slow vertical Spectra lines rising through the letters in your Cool / Warm colours — reads more like the lightfield behind it than a quick flare streak.
- Fixed (v0.43.8): the Today logo flare reads clearly now — it was blending in a way that made it disappear on white logos; the ice → amber streak paints through the letters about every 3 seconds.
- Fixed (v0.43.7): the Today logo flare actually shows — the sweep loads the image in a way that clips correctly and runs brighter / more often.
- Changed (v0.43.6): the Today logo loses the soft glow — instead a thin ice → white → amber lens-flare streak sweeps across it (still when reduced motion is on).
- Changed (v0.43.5): the Today logo gets a soft ice/amber glow that gently breathes (stays still if you prefer reduced motion).
- Changed (v0.43.4): the Today logo is a bit smaller again.
- Changed (v0.43.3): the Today logo is anchored flush to the bottom-right of the greeting panel (not floating mid-banner).
- Changed (v0.43.2): the artist **logo** on Today sits in the bottom-right of the greeting panel, a bit larger.
- Changed (v0.43.1): the artist **logo** on Today is larger and sits tighter in the top-right corner.
- Changed (v0.43.0): your **emblem** sits next to the artist name in the left rail; the **logo** is larger and tucked into the top-right on Today (and previewed on the Settings banner). Custom Cool/Warm and custom banner gradients open from a **Custom** button instead of sitting in the row.
- Added (v0.42.0): artists can have a **logo** (wide lockup, shown larger on Today) and a separate **emblem** (square profile mark in Settings / the artist list). Upload each in Settings.
  - Under the hood: **run migration `023` in Supabase** so emblems can save. (Migration `022` is still needed for custom colors.)
- Added (v0.41.0): in Settings you can pick **custom Cool / Warm colors** (opens a colour slider) on top of the presets, and a **custom banner** with an optional second colour for a soft gradient. Choosing a preset clears custom accents again.
  - Under the hood: **run migration `022` in Supabase** so custom colors can save.
- Changed (v0.40.0): Settings labels the accent picker **Color** (not Colour). There are more accent palettes — including a black-and-white **Noir** — and more banner color washes to pick from.
- Fixed (v0.39.2): logo and banner changes in Settings update right away (with a short “Uploading…” / spinner while a file is still going up) instead of sitting still until a later refresh.
- Fixed (v0.39.1): choosing **Spectra (default)** again restores the original lightfield look — other palettes still tint the field.
- Changed (v0.39.0): picking an artist **colour palette** in Settings now also re-tints the moving light behind the app (and the still fallback when motion is off) — same ice / amber tones as the rest of the UI.
- Changed (v0.38.0): your artist **logo** no longer sits next to the name in the left rail — it shows on **Today**, top-right of the greeting, at a comfortable size.
- Added (v0.37.0): TEMPO now works for more than one artist name. Add an **artist** in Settings — each one keeps its own spaces, tracks and projects, and you switch between them from the left rail. Everything you already have moves onto one artist automatically, so nothing changes until you add a second.
  - Each artist gets its own look: pick one of six **colour palettes**, upload a **logo**, and set a **banner** (your own image, or one of six colours). The banner shows behind the greeting on Today and on the artist's card in Settings.
  - Your colours carry through the whole app — buttons, the board's stage colours, the covers TEMPO draws for tracks without artwork, and the waveform. A bounce you share by guest link shows that artist's colours too.
  - Whatever you pick, it still looks like TEMPO: the palettes are a fixed set chosen to stay readable on the dark UI, green still means good and red still means blocked for every artist, and the TEMPO mark itself doesn't change. Leave everything untouched and the app looks exactly as it did.
  - Under the hood: **run migration `021` in Supabase before this deploys** — the app won't load spaces without it.

## 2026-07-28

- Changed (v0.36.7): **Remove** on Board cards is quieter again (still always visible, a bit clearer on hover).
- Changed (v0.36.6): **Remove** on Board cards is muted but always visible (clearer on hover).
- Changed (v0.36.5): **Remove** on Board cards is a bit easier to see on hover (still hidden until you hover the card).
- Changed (v0.36.4): **Remove** on Board cards stays invisible until you hover the card, then only faintly.
- Changed (v0.36.3): **Remove** on Board cards is barely visible until you hover it.
- Changed (v0.36.2): tracks with no stage stay hidden on the Board — use a stage’s **+ → Existing track…** to place them. The card control is a dark **Remove** (clears the stage, doesn’t delete).
- Changed (v0.36.1): Board copy talks about **stages** instead of “off/on board.”
- Added (v0.36.0): each Board stage has a **+** to add an existing track with no stage, start a new track in that stage, or pin a **sticky note** (board-only reminder — not a track). Notes drag between stages; delete removes them.
  - Under the hood: **run migration `020` in Supabase** so sticky notes can save.
- Fixed (v0.35.2): after you clear a track’s stage, you can place it again from a stage’s **+ → Existing track…** (or pick a stage on the track page).
- Fixed (v0.35.1): saving a named track order now tells you clearly if migration `018` still needs running in Supabase (instead of a vague failure).
- Added (v0.35.0): you can clear a track’s stage without deleting it — it stays in Tracks; place it again from a stage’s **+** or the track page.
- Added (v0.34.0): Tracks has the same Comfortable / Compact density toggle as the Board — Compact is a thin text row (title, momentum, stage), no cover or extra meta.
- Added (v0.33.0): spaces can now be **tasks-focused** instead of music-focused — pick "Tasks & projects" when creating a space, or flip it later in Settings. A tasks-focused space drops Board and Tracks from the nav and Today, and shows open tasks and project progress instead. Good for something like running social media out of TEMPO alongside your music.
  - Under the hood: **run migration `019` in Supabase.** Tasks are now scoped to their space — existing tasks with no track or project link (and projects with no space) won't show up until you re-add them inside a space.
- Fixed (v0.32.1): Sort / Filter menus no longer stretch or jump the Tracks (and Board) header — they open as a floating panel, and Filter shows a count instead of a long label.
- Changed (v0.32.0): Board and Tracks **Sort** and **Filter** live in the header as small menus (no full-width bar when closed). Board can also sort cards inside each column (Custom, title, updated, deadline).
- Changed (v0.31.1): Board and Tracks filter/sort bars take less room — smaller chips, one compact toolbar, and Filters tuck away until you open them (Tasks got the same denser bar).
- Added (v0.31.0): on Tracks, **Save order** stores your Custom arrangement under a name and adds it to the Sort row — pick it anytime later. You can also apply a saved order as Custom, overwrite one from Custom, or remove it.
  - Under the hood: **run migration `018` in Supabase** so named orders can stick. (Migration `017` is still needed for the live Custom drag order.)
- Added (v0.30.0): on Tracks you can filter (type, stage, tag, blocked/waiting/overdue) and sort (Custom, title, stage, updated, deadline). Custom is the default — drag rows to rearrange, and the order is saved.
  - Under the hood: **run migration `017` in Supabase** so custom order can stick. Without it, Tracks may fail to load or reorder.
- Fixed (v0.29.1): Board density icons were swapped — fewer lines is Comfortable, more lines is Compact.
- Changed (v0.29.0): Board Compact density is now a thin text row — title only (plus a tiny momentum / blocked mark), no cover art or extra meta — so packed columns stay easy to scan.
- Fixed (v0.28.1): cover art (and other private files) no longer re-download every time you open a page — TEMPO reuses the same download link for about an hour so covers appear instantly when you move around or refresh.
- Changed (v0.28.0): the assistant can now propose track edits you confirm — BPM, key, genre, title, type, blocked/waiting, and the stage/momentum/deadline/next-move changes it already knew — so asking to set a song to 174 BPM should bring up a confirm button instead of a dead end.
- Added (v0.27.0): the floating assistant now has a mic and a paperclip like Import — talk in (live dictation, or record-and-transcribe), and attach screenshots, PDFs, or text files with your question.
- Changed (v0.26.0): the floating assistant can propose more real workspace moves now — including moving a track to another stage, setting a next move, setting a task due date, and adding a project — still only after you tap to confirm, and it still won't delete anything.
- Fixed (v0.25.4): the notifications panel was sitting behind Today and other page content — it now opens in front.
- Fixed (v0.25.3): the notifications panel was opening off the left edge of the screen — it now opens into the workspace so you can read it.
- Fixed (v0.25.2): the floating assistant was failing on ordinary questions (like how many songs you have) and only saying it couldn't answer — it should reply properly again.
- Fixed (v0.25.1): Today's drifting cover strip no longer runs out and jumps back — it loops continuously.
- Added (v0.25.0): a floating **assistant** in the bottom-right of every main screen — tap the TEMPO mark (or press Cmd/Ctrl+/) to ask how something works or what's going on in your catalog. It can propose a small change (add a task, mark one done, set a deadline, open a screen); nothing is written until you confirm. Hidden on Focus and Import so those stay distraction-free.
  - Under the hood: **run migration `016` in Supabase** before relying on the daily ask limits. Without it the assistant still answers, but usage tracking won't stick across servers.
- Changed (v0.24.7): Spectra cover **backgrounds** use an even broader hush palette (coral, sky, sand, orchid, aqua, berry, honey, and more) and soft tri-hue blends — slits stay ice / white / amber / gray.
- Changed (v0.24.6): Spectra cover **backgrounds** are softer and use a wider hush palette (teal, rose, lilac, mint, peach, and more) — the slits themselves stay ice / white / amber / gray.
- Changed (v0.24.5): Spectra cover backgrounds are back to the quiet studio-light set (cool rim, warm floor, white haze, side leaks, gray mist, corner glow).
- Changed (v0.24.4): another Spectra cover background option — quiet “print” textures (cool/warm scanlines, soft inset frame, diagonal hairlines, flare whisper, grain) instead of the studio-light set.
- Changed (v0.24.3): Spectra cover backgrounds are quieter now — soft studio lighting (cool rim, warm floor, white haze, side leaks, gray mist, corner glow) instead of the loud color panels.
- Fixed (v0.24.2): Spectra cover backgrounds were invisible (a blur layer was covering them). They’re painted inline now and should read clearly — ice wash, amber wash, diagonal split, band stack, corner blocks, or a white well — behind the slits.
- Changed (v0.24.1): Spectra placeholder covers now show up wherever a track’s artwork would — Tracks list, Board cards, track header, project track rows, and Today’s attention list — not only the Today strip. Backgrounds are also much more obvious (ice panel, amber panel, diagonal split, band stack, corners, white well).
- Changed (v0.24.0): temporary cover slits sit in a mid length range (not too tall or short), and each track gets a more distinct Spectra **background** (ice bloom, amber pool, diagonal split, horizons, corners, or a soft striped well) so covers are easier to tell apart without changing the title language itself.
- Changed (v0.23.9): temporary covers are denser again, and the Spectra art palette is ice / white / amber / gray only — no purple.
- Changed (v0.23.8): temporary covers are sharper (less blur), the horizontal flare line is gone, and each track uses a stronger layout/color mode so they look more distinct from each other.
- Changed (v0.23.7): temporary covers have more distinction per track — different silhouettes, spacing, height waves, and background bias so they don’t all look the same.
- Changed (v0.23.6): temporary covers keep the light brightest in the middle (quieter at the sides and on each slit’s ends), with a quiet ice→amber Spectra background under the lines.
- Changed (v0.23.5): temporary covers are vertical again — soft vertical Spectra slits from the title language, with a light blur (not the heavy glow, not the hard chrome look).
- Changed (v0.23.4): temporary covers try another Spectra look entirely — stacked horizontal “aurora” ribbons from the title language (soft blur, slow drift), instead of vertical columns.
- Changed (v0.23.3): temporary covers try a different Spectra look — sharper vertical columns, ice/amber chromatic split, a thin flare line, and much less soft glow.
- Changed (v0.23.2): temporary Spectra covers glow softer now — blurred bloom behind the slits, a light prismatic haze, and a fade at the edges so they feel closer to TEMPO's light field.
- Changed (v0.23.1): temporary Spectra covers have more line variety again — common letters sit at medium weight, thick is for accents, and overall slits are a bit slimmer.
- Changed (v0.23.0): temporary Spectra covers are denser — short titles repeat more, featuring / parenthetical text is part of the art again, and common letters (including vowels) draw thicker slits so the field doesn’t look sparse. Long titles are still capped.
- Added (v0.22.0): temporary covers are now shaped by the **Spectra Title Language** — each track's title quietly drives the color, length, weight, and seat of the vertical light slits (featuring credits left out of the art; numbers count like letters). Design-first, not a puzzle to decode. Same language can be reused elsewhere later.
- Changed (v0.21.7): temporary covers now look like TEMPO's Spectra field — vertical ice/white/amber light slits on black, each track getting its own pattern so they don't all match.
- Changed (v0.21.6): Today's cover strip and the temporary Spectra sleeves drift slower and smoother — the laggy blur on moving bands is gone.
- Changed (v0.21.5): temporary covers match TEMPO's Spectra look — soft rectangular blurred light bands that drift, instead of circles or a big letter.
- Changed (v0.21.4): temporary covers for tracks without art are abstract Spectra sleeves now (glow, rings, flare) — no big letter.
- Changed (v0.21.3): tracks without cover art still show up in Today's drifting strip — each gets a temporary TEMPO-styled cover (glow + title) until you upload real art.
- Changed (v0.21.2): Today's cover strip drifts slower, the covers are larger, and they sit faded until you hover one.
- Changed (v0.21.1): the cover strip on Today is label-free — just the drifting artwork as a design piece.
- Added (v0.21.0): **Today ends with a slow-moving strip of your track covers** — two rows drifting opposite ways. Tap any cover to open that track. Tracks without art still show their usual colour gradient. If you prefer reduced motion, the strip sits still and you can scroll it yourself.
- Fixed (v0.20.1): when you import a song whose title includes a featuring credit — like "Midnight (feat. Lena)" — TEMPO keeps that in the title instead of stripping it out.
- Changed (v0.20.0): **the sign-in and create-account screens now show the TEMPO wordmark instead of plain text**, and the light field on the right sits inside its own large rounded window rather than fading across the whole page — the left side is now a plain, solid panel.
- Added (v0.20.0): **creating a new account now needs an invite code.** Anyone without one sees a "Request an invite" link that emails you directly. Existing accounts are unaffected — this only gates new sign-ups through the form.
  - Under the hood: set `INVITE_CODE` in `.env.local` and in Vercel's environment variables to whatever code you want to hand out — signups are closed until it's set. Signing up via Google/Microsoft/Apple has been removed from the create-account screen for now, since those can't be gated by the code; they still work from the sign-in screen for people who already have an account.
- Changed (v0.19.0): **the sign-in and create-account screens are now two-column on desktop.** The left side has the form; the right side is the animated Spectra light field — no extra imagery, just the thing that already makes TEMPO feel like TEMPO. Both pages also now have "Continue with Google", "Continue with Microsoft", and "Continue with Apple" buttons below the email/password form, so you can sign in with your existing account from any of those providers (each one needs to be turned on in Supabase before it goes live). The password field now has a show/hide toggle.

## 2026-07-27

- Fixed (v0.18.3): importing a batch of new singles no longer wraps each one in its own project. Projects are for real groupings now — an EP, an album, an edit pack, or a campaign — so a handful of unrelated new songs come in as plain tracks with no project attached. Say you're working on an EP or album (or the material clearly names one with several tracks under it) and TEMPO still groups them the way it did before.

- Fixed (v0.18.2): TEMPO was asking two or three unrelated questions at once during the import conversation — a multiple-choice one followed by a couple of open-ended ones, all stacked in a single message. It now asks one thing at a time, picks whichever question matters most first (like whether a batch of tracks belongs to one project, before asking about any single track's stage), and waits for your answer before moving to the next.

- Fixed (v0.18.1): earlier in the import conversation, replying to one of TEMPO's questions made the question disappear — the thread looked like a pile of your own messages rather than a back-and-forth. It's a proper conversation now: TEMPO's questions stay on screen next to whatever you answered.
- Added (v0.18.1): **talking to TEMPO now works like dictation, not a recording.** In Chrome, Edge, and Safari, tap the mic and your words appear in the message box live, as you speak — so you can fix a mangled song title before it's sent, instead of finding out afterward. Browsers without that support (Firefox) fall back to the previous record-and-transcribe behaviour.

- Added (v0.18.0): **you can delete tracks properly now.** On the Tracks page, hit "Select", tick as many tracks as you want, and delete them together — you get a confirmation naming every track going and warning that their bounces, comments, checklists and session history go with them. On a track's own page, delete now lives in a new **Edit** menu in the bottom-right of the track's header, alongside "Edit layout". It used to be buried inside the Details panel, which most layouts hide — so on a lot of setups there was no way to delete a track at all.
- Changed (v0.18.0): **the import screen is a conversation now.** Instead of three separate boxes for files, text and voice, it's one chat: type, hit the mic, or drop files straight in, all in the same thread. TEMPO answers as you go — it tells you what it actually found in what you sent ("That screenshot lists 12 project folders; looks like 8 songs"), and asks for what's missing rather than waiting until the end to guess. Answer in your own words or tap one of the suggested answers. Screenshots and spreadsheets are read the moment you attach them, so you can talk about what's in them straight away.
- Changed (v0.18.0): TEMPO asks more questions when you've given it less to work on, and fewer when you've been thorough — up to eight on the review screen, rather than a fixed handful.
- Added (v0.18.0): a "Got a lot to add? Import them all" link in the New track box, for when adding them one at a time isn't the right tool.
- Fixed (v0.18.0): building a workspace could leave the import stuck showing "building" forever if you double-clicked or your connection dropped — the workspace was built correctly, but the screen never moved on.
- Under the hood: **run migration `015` in Supabase** (as well as `014`). It fixes the stuck-import problem above and repairs any import already affected.

- Added (v0.17.0): **you can now bring your existing music into TEMPO instead of typing it all in.** There's a new "Bring your music in" screen — you'll land on it when you make a new account, and it's always there under Settings → Import. Give it whatever you already have: type or paste a song list, describe your catalog in your own words, record a voice note, drop in screenshots of your project folders or a whiteboard, or upload a release spreadsheet, PDF, or Word doc. TEMPO reads all of it together and proposes a workspace — tracks with their stage and momentum, EPs and albums, tasks, target dates, who you're waiting on. Nothing is added to your catalog at that point. You get a review screen split into "Ready to add" and "Needs your eyes", where every single thing is editable and tells you where it came from and how sure TEMPO is ("From the folder 'EP Echoes'"). If it spots something ambiguous — three files that look like the same song at different stages, or a title you already have — it asks you rather than guessing, and you can answer with one tap and have it redraft. Untick anything you don't want. Only when you press "Build my TEMPO workspace" does anything get created, and it's created all at once — if something goes wrong, nothing is added rather than half a catalog. You can discard an import at any point, which deletes the files you uploaded along with it.
- Under the hood: **run migration `014` in Supabase before using this**, and add an `OPENAI_API_KEY` to your Vercel environment variables (it's already in your local `.env.local`). Without the migration the Import screen won't be able to save anything; without the key it'll tell you the AI connection isn't set up. Files you upload during an import go to private storage and are deleted once you build the workspace or discard the import.
- Changed (v0.17.0): the drop-a-file areas for bounces and stems/artwork now share one piece of plumbing with the new import screen. They look and behave exactly as before.

- Changed (v0.16.0): down to two fonts instead of three. Titles (page headings, track and project names, the logo) use Space Grotesk; everything else — body text and all the numbers (BPM, keys, timestamps, counts) — now uses Inter. Numbers won't line up in perfectly even columns anymore the way a true monospace font did, but the app reads as one consistent typeface doing two jobs instead of three competing ones.
- Added (v0.16.0): a soft glow follows your cursor around any track, project, or task you can click on — the board, Tracks, Today's attention list, project track lists, and the release track order all pick it up. It runs through the app's own ice → white → amber colours (never a random rainbow), and turns warning-orange automatically on anything blocked or overdue.
- Changed (v0.16.0): the logo in the rail is now built from the app's own light — the same moving field behind Today's hero — instead of a flat image.
- Changed (v0.16.0): hints of the animated light field now show up in more places — a thin line down the inside edge of the left rail, an echo strip along the very bottom of the app, and small lit dividers between filter rows, under column headers, and inside the track workspace's grouped tabs.

- Changed (v0.15.0): Board, Tracks, Projects and Tasks stop feeling half-empty. Tasks now lays your week out as four columns — Overdue, Today, This week, Later — instead of one narrow list, and each says something calm when it's clear rather than showing nothing. Track rows are taller with bigger artwork and now tell you what's actually next on the track (or why it's stuck) and which stage it's in. Project cards show their track and task counts as readable figures with checklist progress along the bottom, and there's a "New project" tile at the end of the grid. On the Board, when you only have a couple of tracks the cards grow so the columns don't look hollow.
- Changed (v0.15.0): the Board and Tasks filters are tidied into a single bar with the labels lined up, plus a "Clear filters" link once something is set. Card density moved out of the filters — it's a view setting, so it now sits as a small toggle beside Stages and Track. Each Board column also carries a faint tint of its stage colour, so the pipeline reads cold-to-warm from Idea through to Released, and the thin light strip is now a rounded divider inside the column header instead of a bar cut off by the rounded corners.

- Added (v0.14.0): the track page is now yours to arrange. Everything on it — the player, versions, workflow, guest links, session log, checklist, comments, files, notes, references, people, activity and details — is a module you can move. Hit "Edit layout", drag modules between the left and right columns, and hide anything you don't want. Drop one module straight onto another and they combine into a tabbed panel, so related tools share one space instead of stacking up. Drag the divider between the columns to set how wide each side is. Presets (Writing, Production, Feedback, Mix review, Release prep) each set up a focused arrangement rather than showing everything at once, and anything a preset leaves out is one click away. Your arrangement is saved per track and is yours alone — collaborators keep their own.
- Under the hood: run migration `012` in Supabase before using this. Until you do, the track page falls back to the standard layout and your changes won't stick.
- Fixed (v0.14.0): the track tools no longer sit in a cramped tab strip that hid Details, People and Activity behind a horizontal scrollbar.

- Changed (v0.13.0): a visual overhaul. TEMPO now has depth — surfaces are layered and lit rather than flat outlines, so the important things on a screen actually look important. The Today greeting is a proper hero: your active / due / session counts are large and readable at a glance, the quick actions live inside it, and the animated light field is finally visible behind it instead of hidden under a black cover. Every page opens with a bigger title and the signature flare line. Empty states and the board's drop zones look like places something goes, instead of a sentence sitting in a box.
- Changed (v0.13.0): the board no longer scrolls sideways. Stages share the width of your screen, and any stage with nothing in it shrinks to a slim labelled strip so the whole pipeline stays visible at once — start dragging and every stage opens back up so you can drop anywhere. On a phone or narrow window the stages stack vertically instead.
- Fixed (v0.13.0): artwork now shows up on the Tracks list. It was being loaded with a plain link to private storage, which never resolves, so every cover came up blank; tracks without artwork still show their colour instead.

## 2026-07-26

- Fixed (v0.12.2): collaboration features now explain themselves instead of breaking. If the database isn't set up for collaboration yet, the People panel loads empty rather than erroring, and trying to invite someone tells you to run the migrations first. Invite links that can't be opened because the server is missing its access key now show a clear "unavailable" message instead of failing silently.
- Under the hood: there's now a single `migrations/_run_all_001_to_011.sql` file you can paste into Supabase in one go, instead of running migrations 001–011 one at a time.
- Changed (v0.12.1): the animated light strip along the very top of the app is a bit taller (~14px) so you can actually see the Spectra motion running there.
- Added (v0.12.0): **Release workspace** on projects — choose General / Single / EP / Album / Edit pack; release types get date/countdown, transparent readiness, metadata & credits with copy/CSV export, distribution & pitching fields, timeline, optional release-plan preview, and a post-release section. **Track collaboration** — invite by email + role (editor / uploader / commenter / viewer), copy invite link, accept after sign-in, People + Activity tabs, in-app notification center (no email yet). **Workspace customize** — presets and module order per user. **Today & Board polish** — Needs attention queue with plain-English reasons, Board attention filters and Compact/Comfortable density.
- Under the hood: run migrations `001` through `011` in Supabase (in order) before relying on these features in production, and set `SUPABASE_SERVICE_ROLE_KEY` in Vercel / `.env.local` for guest review and invite acceptance.
- Added (v0.10.0): four big additions to the track workspace. **Milestones, decisions & blind A/B** — the version list is now a chronological timeline: pin a bounce as a milestone (with a type and label), record a decision (approved / needs changes / rejected, with an area and note — the latest shows inline, older ones log below), and see comment counts at a glance. Deleting a version now warns you if it's pinned, has comments/decisions, or is shared on an active guest link. Pick any two versions for a **blind A/B** — identities are hidden and randomly shuffled until you reveal, playback is one-at-a-time with independent volume, and you can log your pick (and optionally a decision) once revealed. **Stage recipes** — set up a stage so that moving a track into it can apply a checklist template, create a task, set the next move, change momentum, or ask for a decision; choose "preview" (pick which actions to run each time) or "automatic" (runs immediately with a toast and one-tap undo). A lightning-bolt mark on the stage timeline shows which stages have a recipe, and a "Recent automations" section on the track page shows what ran (with a retry for anything that failed). Writing/Production/Mixdown/Master/Release Prep stages get a one-click "add suggested recipe" starting point. **Focus sessions** — start one from the track page or Today with a goal and an optional handful of checklist items; it drops you into a distraction-free session screen with a live timer, the waveform, your checklist subset, and private scratch notes, and warns before you leave with unsaved notes. Ending a session asks what changed, what's left, and the next move (optionally set as the track's official next move, with a bounce upload and checklist checkoffs); abandoning discards the timer. Today now shows your total focus time this week and lets you jump back into a session still running. **References** — a new References tab on the track page holds inspiration: other tracks, images, links, or plain notes, each with an optional "why this matters" note and, for audio, a start/end clip; star any reference to carry it into your next focus session.

- Added (v0.9.0): guest review links — share a bounce with someone outside TEMPO without giving them an account. From the track page, create a link to one fixed version (comments on / download off by default, 14-day expiry), copy the one-time URL, and see it listed as active, expired, or revoked (revoke anytime, without deleting comments already left). The guest opens a focused, branded page — title, artwork, that one version's waveform, and a comment box (name + note, optionally pinned to a moment) — with no sign-in, no access to your notes/checklist/other versions, and the page kept out of search engines.
- Added (v0.8.0): timestamped comments on the waveform. Pin a note to the exact moment in a bounce — "Add comment here" while listening, or click a marker on the waveform — reply, resolve/reopen, edit, or delete (with confirm) from a new Comments tab on the track page, which shows how many are still open. Switch between "this version" and "all versions"; clicking an older comment jumps to (and loads) the right bounce and moment. Deleting a version now tells you how many comments go with it before you confirm.
- Under the hood (v0.7.1): built the data-layer plumbing for a batch of upcoming features — timestamped comments, guest review links, version decisions/milestones, stage recipes (auto-checklist/task setup when a track changes stage), focus sessions, reference tracks, collaborator invites, activity + notifications, workspace layout preferences, and release metadata. Nothing in the app looks or behaves differently yet — none of this is wired into a screen — it's the groundwork the next feature updates will build on.
- Added (v0.7.0): the track page got a redesign into a proper studio workspace — an artwork-tinted identity header, a horizontal stage timeline you click (or arrow-key) through, and your tools (Work checklist, Files, Notes, Details) live in a tab panel that remembers its state when you switch tabs and can be deep-linked (e.g. jump straight to Files). Jumping more than one stage at once asks you to confirm first.
- Added: a Now / Next / Blocked / Target strip under the player — set your next move and its due date, note who you're waiting on, flag a blocker, and see your target date, all editable right there. Underneath, a short plain-English list explains anything that needs attention (blocked, next move overdue, deadline soon, quiet for a week+, stuck in a stage for two weeks+), with a way to see all of it if there's more than a couple of flags.
- Added: Board cards now show a "Next:" line when a track has a next move set, plus a small warning mark when a track is blocked or its next move is overdue.
- Changed: "Delete track" moved from the bottom of the track page into the Details tab.
- Under the hood: run migration 001 (`001_track_workflow.sql`) in Supabase — until then the new next-move/blocked/waiting-on/target fields safely stay blank instead of breaking the page.
- Added (v0.6.10): next-generation product and technical specifications for upcoming TEMPO work (track workspace redesign, feedback links, milestones, focus mode, collaboration, and more). No user-facing behavior changed in this update — planning docs only.
- Added (v0.6.9): a Create account screen at `/register` (email + password), with a link from Sign in.
- Changed (v0.6.8): sign-in is email + password now (no magic-link emails), so you won’t hit Supabase’s tiny free email rate limit while testing.
- Fixed (v0.6.7): wav→mp3 converter loads from the app itself (not a flaky CDN), so localhost conversion works; if conversion still fails, TEMPO uploads the original bounce when it’s under 200 MB.
- Added (v0.6.6): wav and aiff bounces are automatically converted to mp3 in your browser before upload (320 kbps) so big studio exports fit under cloud size limits — you’ll see “Converting…” then “Uploading…”.
- Fixed: production magic-link sign-in no longer sends you to localhost — the live app always redirects to https://tempo-ten-sigma.vercel.app (local still uses localhost when you sign in there).
- Fixed: Vercel build failure from the shader / Three.js types.
- Changed (v0.6.5): each track keeps only the **latest 2** bounces — uploading a third removes the oldest so storage stays lean (you can still A/B the two you have).
- Fixed (v0.6.4): artwork / file names with spaces no longer fail upload (“Invalid key”); bounce size errors now explain the real limit (your Supabase Storage setting, often 50 MB by default).
- Added: tap the track’s cover square to upload cover art (also still works from Stems & assets → Artwork).
- Under the hood: to allow ~80–200 MB wavs, open Supabase → Storage → Settings and raise “Global file size limit” to at least 200 MB (TEMPO already allows up to 200 MB on the client).

- Fixed (v0.6.3): Today / Board no longer crash with “Cannot find module three.js” — the shader loads only in the browser and the Next cache is cleared on the next local start.
- Fixed (v0.6.2): local launcher finds Node when started from Finder (loads your usual PATH / Homebrew).
- Added (v0.6.1): double-click **Launch TEMPO.command** in the project folder to start a local copy and open it in your browser (leave the Terminal window open while you work; Ctrl+C stops it).

- Added (v0.6.0): upload audio versions (mp3 / wav / aiff / m4a, max 200 MB) with a “what changed?” note; each bounce is numbered and marked current; play, set current, download, or delete with confirm.
- Added: waveform player on the track page — play/pause, elapsed/total, and a version dropdown to A/B older bounces.
- Added: stems & assets upload by kind (stem, MIDI, artwork, lyrics, reference, other); artwork uploads set the track thumbnail; download and delete.
- Added: session log on each track — one-field composer, reverse-chron list, optional link to today’s upload.
- Added: Tasks page with quick-add, category/status filters, and groups Overdue / Today / This week / Later; linked tracks and projects deep-link as chips.
- Added: Projects — card grid with deadline, member counts, and checklist %; detail page to attach/detach tracks and tasks.
- Added: Today is the home screen after sign-in — greeting banner with active tracks / due this week / sessions this week, Tasks due, In motion (Active tracks), and quick actions (+ Track, + Task, Log session).
- Added: Spectra shader moments — brief intro behind the TEMPO wordmark (once per session), thin animated top edge on desktop, and shader empty states on Board and Today; respects reduced motion and pauses when the tab is hidden.
- Added: installable PWA (dark theme), clearer focus rings, loading skeletons, and error toasts.
- Changed: track artwork thumbnails load through signed links from private storage.

- Added (v0.3.0): open any track into its own workspace page — edit the title inline, set momentum / stage / deadline, and see BPM, key, version count, and type at a glance.
- Added: per-track checklist with add, edit, toggle, drag-reorder, and delete; thin ice→amber progress bar; apply a template or save the current list as a new template.
- Added: four built-in checklist templates on first sign-in — Arrangement, Mixdown, Master Prep, and Release Prep.
- Added: freeform notes that save as you type, plus a details panel for artist alias, type, BPM, key, genre, destination, and tags.
- Changed: tapping a track on the board or in the Tracks list opens the track workspace instead of the edit modal.

- Added (v0.2.0): version number under Settings in the left rail so you can see which build you’re on.
- Added: Spaces — on first login you get Originals and Edits & Remixes with default stages; switch spaces from the rail; create, rename, reorder, and delete spaces in Settings.
- Added: Stage editor on the board — add, rename, drag-reorder, and delete stages; if a stage has tracks, you pick where they move.
- Added: Kanban board for the active space — drag tracks between stages, filter by type and tag, empty-state invite when there’s nothing yet.
- Added: Create / edit tracks (title + type required; more details optional); park or delete with confirm; Tracks list for the active space.
- Changed: phone Add button opens a new track on the board.
- Added: TEMPO is live on the web at https://tempo-ten-sigma.vercel.app — sign in with a magic link (email, no password) and sign out from Settings.
- Added: the dark studio app shell with navigation for Today, Board, Tracks, Projects, Tasks, and Settings (desktop side rail; phone bottom tabs).
- Added: living product docs (this changelog and the product overview) so the musician owner can see what exists today.
- Under the hood: cloud database and private audio storage are provisioned; no migration to run for this update.
