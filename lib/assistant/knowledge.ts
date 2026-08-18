/**
 * Condensed product reference for the floating assistant.
 *
 * Keep this in sync when PRODUCT.md's feature set changes — the model only
 * knows what is written here. Target ~900–1200 tokens; dense reference, not
 * prose. Screen names and enum values must stay exact.
 */

export const PRODUCT_KNOWLEDGE = `CORE OBJECTS
- Artist: an artist name/alias the user releases under. Owns spaces (so all tracks/projects/tasks belong to one artist). Has its own accent palette (curated presets including Noir, plus optional custom Cool/Warm colours), logo (wide, Today), emblem (square profile), and banner (image, color, or two-stop gradient). Switch from the rail; manage in Settings. Most users have exactly one.
- Space: a private working room. Artist Spaces can be music-focused (their own song Board/Tracks pipeline) or tasks-focused (Tasks and Projects); artist defaults are Originals and Edits & Remixes. Pro homes can also create, switch, rename, reorder, and delete multiple Spaces. Their Spaces stay separate from managed artists and include a workflow Board for professional tasks. Switch from the rail; manage in Settings.
- Stage: where a track sits in the pipeline (Idea, Writing, Production, Mixdown, Master, Release Prep, Released by default). Per-space, reorderable.
- Track: a musical work. Fields include type, momentum, deadline, next move, blocked/waiting, BPM, key, tags, notes. Optional list group on Tracks (album/EP/playlist bucket) — independent of projects.
- Version: a bounce/upload on a track. Every version stays in the track's history forever. Cloud storage keeps only the current version and the one before it (older ones are evicted from the cloud once a desktop copy is confirmed — never before, so nothing is lost); the desktop app keeps the complete history locally. version_no and is_current are DB-managed.
- Project: a work container you define (not one-track-per-project). Optional type: general / single / ep / album / edit_pack. May attach many tracks and tasks, or none. Release types unlock the release workspace. Not the same as Tracks-page groups.
- Task: actionable item. status: todo/doing/done. Optional track or project link. Categories start as social/outreach/pitching/admin/production/other, but each artist or Pro home can rename, recolor, and add shared categories from Tasks or the Pro Board.
- Focus block: logged studio time on a track (goal, duration, outcome). Shown in the track's Focus log. Not the same as Sessions.
- Session: a persistent room for people working on a song together. Agenda, notes, pins, tasks, chat, live instances (calls), decisions, and past sessions. Membership is an explicit roster. A Session grants access to THE ROOM, never to anyone's catalog.
- Comment: feedback on a bounce, optionally timestamped; can be resolved.

ENUMS (exact values)
- space focus: music / tasks
- momentum: active / simmering / stalled / parked
- track type: original / remix / edit (collaboration is a credit/people relationship, not a track type)
- built-in task categories: social / outreach / pitching / admin / production / other; custom category keys are also valid after migration 108
- task status: todo / doing / done
- project type: general / single / ep / album / edit_pack
- collaborator roles: editor (edit metadata/workflow, upload, resolve comments), uploader (upload only), commenter (play + comment), viewer (play + read-only)

MOMENTUM VS STAGE
- Stage = where the track is in the pipeline (Idea → Released).
- Momentum = whether it is moving: active, simmering, stalled, or parked.
- A track can be in Mixing and stalled; stage and momentum are independent. First-timers often confuse them.

WHERE THINGS LIVE
- First workspace open: after Origin, an optional five-step tour spotlights Today, quick actions, navigation, global search, and the assistant. Skip asks whether to leave only this introduction or all remaining page tours; the choice is remembered per artist. Settings → Replay introduction deliberately replays both the Origin film and the tour. Pros have the same pair in Settings → Passage (Open Passage revisits the story; Replay introduction runs the film from Tune in and re-offers the Pro guide choice). Artist tours and Pro guides stay separate on a dual account.
- Today (/): greeting, quick actions, and — in a music space — due tasks, up to four needs-attention items with Show more, and a drifting cover strip; in a tasks-focused space — open tasks and project progress instead. A Pro home keeps those personal tasks/projects and adds Waiting on you (assigned work across artists) plus an Artists you work with roster hub.
- Board (/board): mode-aware. In a music-focused artist Space it is Kanban by song stage; populated desktop columns scroll horizontally and phone columns stack. Dragging a track or note to another stage slides it into that column. Stage + adds an existing unplaced track, a new track, or a sticky note. In a Pro Space it is a professional workflow Board using the same tasks as Tasks, with To do / In progress / Done columns, drag-to-update status, quick add, and category/project/search filters. A Pro Board never shows songs or changes an artist pipeline.
- Calendar (/calendar): month, week (hour-by-hour, with a display timezone setting), agenda, and creative timeline across tasks, track dates, projects, releases, pitching, and standalone events. Each type has a distinct default color; Categories renames/recolors types and adds custom event categories after migration 075.
- Tracks (/tracks): list + create/select/delete; optional named groups (album/EP/playlist buckets — independent of projects, not 1:1 with them); drag tracks within/between groups in Custom sort; filter by type/stage/tag/attention; sort Custom (drag) / title / stage / updated / deadline / named saved orders (Save order → Sort chips). Music-focus spaces only.
- Track workspace (/track/[id]): player, versions, guest links, checklist, comments, files, people, layout modules.
- Focus (/track/[id]/focus): distraction-free focus block — timer, waveform, checklist, scratch notes.
- Projects (/projects): card grid, scoped to the active space; attach any number of tracks/tasks (or none) — not a per-track wrapper; release types get release workspace.
- Tasks (/tasks): Overdue / Today / This week / Later columns, scoped to the active space. Drag a task between columns to change its due date — the column you’re over reads Move to today / this week / later / overdue (Today sets today; This week / Later / Overdue asks which day), and the task slides into the new column. Categories opens a shared palette where Tasks writers can rename/recolor built-ins or add/remove custom categories; removing one moves its tasks to Other. Completed work lives in Closed out under the board.
- Sessions (/sessions): persistent rooms with an explicit roster. Agenda, shared notes, pins (titles + artwork), tasks that also appear on Tasks, chat (also in Messages), live instances with voice, video, and screenshare, decisions, and past sessions. Guest join at /join/[token] with a passcode; guests never get a catalog. Not an AreaKey grant. Needs migrations 114–115.
- Artist (/artist): artist-wide rollup ACROSS EVERY SPACE (the only screen that is not space-scoped) — headline counts (tracks, bounces, in progress, released, focus time), 12-month bounces vs tracks-started chart, pipeline per space, all spaces side by side, "your sound" (BPM spread, top keys, genres, track types), work rhythm by day/hour + busiest day/hour + weeks-in-a-row streak, longest-in-progress tracks, release countdowns, feedback received (guest vs own, open threads, decisions), and streaming platforms (Spotify/Apple catalog only, SoundCloud real numbers with a daily-snapshot trend — paste a profile link once per platform to link it). Modular: "Edit layout" in the banner's top-right drags sections between two columns, combines them into tabs, or hides them; saved per artist on the account, so it's the same wherever you sign in. From there you can also start from a layout template (Overview, Minimal, Statistics, Platforms) or create your own custom module — a titled card you fill with any hand-tracked stat (label + optional unit), logging a value for any date and seeing a filled area chart once it has two or more readings; undo a bad entry from its history. Always in the rail, whatever the space focus. All numbers come from existing TEMPO data — nothing estimated except what you log by hand in a custom module.
- Import (/import): conversational catalog intake (also Settings → Import).
- Settings (/settings): artists (name, palette, logo, banner), spaces (name + focus) for the selected artist, stages, templates, import link, sign out.
- Messages (/messages): artist direct messages, artist group chats, Session chats, and a separate private TEMPO Support inbox. The global top-right Messages button shows unread threads and a quick-reply mini-inbox. New message can start a 1:1 thread or a group chat with several artists. From a 1:1, Add someone starts a new group (optional history copy); the original chat stays. Session chats cannot be turned into ad-hoc groups. Full conversations support archive/restore, sender-only deletion, dictation, and up to four private attachments. Support works even when the artist stays off the social network; support staff never appear as an artist profile.
- Scenes (/scenes): rooms for people outside your own catalog — a label, a school, a crew, or any group you're part of, separate from your tracks/projects/spaces. Start one with a name, address, kind, tagline, about, and a door (open/ask-to-join/invite-only); browse ones you're in, discover others, see invites. A scene page has its own feed (post, like, comment, @mention, topics, pinned posts, manager announcements), polls (up to 10 options, single/multi-choice, live results) and open questions (answered as comments, no poll), an Events tab (managers add date/kind/location/capacity, members RSVP going/interested/not-going), and a Chat tab (group thread, text-only for now). Owners/moderators get a Manage dashboard (/scenes/[slug]/manage) for join requests, invites, roles, events, and a moderation log. Being in a scene together never grants access to anyone's catalog. Needs migrations 049–055 run before it works.

HOW TO DO COMMON THINGS
1. Add a track: Board (+ or Add), Tracks, or Today's + Track — title + type; lands in first stage of active space. Music-focus spaces only. Assistant can propose create_track.
2. Move a stage: drag on Board, or click the stage timeline / dropdown on the track page. Assistant can propose move_track_stage with track ref + stage ref.
3. Upload a bounce: track workspace Versions — "what changed?", set current; wav/aiff convert to mp3 in browser.
4. Pin a milestone: pin a version on the timeline to highlight it (rough mix, final master). Every version is kept regardless of pin state now — pinning is for standing out, not survival.
5. Blind A/B: select two versions → Blind A/B; labels shuffled until reveal; can log a decision.
6. Start focus: Today or track Workflow → goal + optional checklist → focus screen.
7. Start a Session: Sessions → New session → add people. Start the session for a live call. Share link for guests (passcode). A Session never opens the catalog.
8. Guest review link: track Guest links — pick version, expiry, comment/download; copy link once; no account needed for guest.
9. Timestamped comment: play bounce → "Add comment here" or waveform marker → Comments tab.
10. Invite collaborator: track People — email + role; copy one-time invite link (you share it). Collaborators see that track only.
11. Stage recipe: Settings or stage — automations on enter (checklist, task, next move, momentum, ask decision); preview or automatic.
12. Release credits/CSV: open a release-type project → release workspace track order/metadata → copy or export CSV.
13. Import catalog: /import — chat, files, voice; review plan; only "Build my TEMPO workspace" writes.

ASSISTANT CAN PROPOSE (artist confirms before anything is written)
create_task, complete_task, set_task_due_date, create_track, create_project,
move_track_stage, set_track_momentum, set_track_deadline, set_track_next_action,
set_track_bpm, set_track_key, set_track_genre, set_track_title, set_track_type,
set_track_blocked, set_track_waiting, navigate. Never delete.
create_support_report is also available for a clearly described bug/help request; show the proposed report and require confirmation before sending.

WHAT TEMPO DOES NOT DO
- Not a full team workspace. Per-track collaborators, Team area grants, Scenes, and Sessions each have their own door. A Session never grants catalog access.
- In-app notification center plus optional daily/weekly email digests (Pulse).
- Import AI will not search the internet, guess songwriting credits, or invent a release plan.
- Assistant cannot listen to audio, read comment threads, or see files beyond the snapshot.
- No legal, contract, royalty-split, or tax advice.`;
