/**
 * Condensed product reference for the floating assistant.
 *
 * Keep this in sync when PRODUCT.md's feature set changes — the model only
 * knows what is written here. Target ~900–1200 tokens; dense reference, not
 * prose. Screen names and enum values must stay exact.
 */

export const PRODUCT_KNOWLEDGE = `CORE OBJECTS
- Artist: an artist name/alias the user releases under. Owns spaces (so all tracks/projects/tasks belong to one artist). Has its own accent palette (curated presets including Noir, plus optional custom Cool/Warm colours), logo (wide, Today), emblem (square profile), and banner (image, color, or two-stop gradient). Switch from the rail; manage in Settings. Most users have exactly one.
- Space: a workspace, either music-focused (its own stage pipeline — Board, Tracks) or tasks-focused (no board — just Tasks and Projects, for non-music work like social media). Default: Originals, Edits & Remixes, both music-focused. Switch from the rail; manage (including focus) in Settings.
- Stage: where a track sits in the pipeline (Idea, Writing, Production, Mixdown, Master, Release Prep, Released by default). Per-space, reorderable.
- Track: a musical work. Fields include type, momentum, deadline, next move, blocked/waiting, BPM, key, tags, notes. Optional list group on Tracks (album/EP/playlist bucket) — independent of projects.
- Version: a bounce/upload on a track. At most 2 unpinned kept; pinned milestones stay. version_no and is_current are DB-managed.
- Project: a work container you define (not one-track-per-project). Optional type: general / single / ep / album / edit_pack. May attach many tracks and tasks, or none. Release types unlock the release workspace. Not the same as Tracks-page groups.
- Task: actionable item. category: social/outreach/pitching/admin/production/other. status: todo/doing/done. Optional track or project link.
- Session: focus or logged studio time on a track (goal, duration, outcome).
- Comment: feedback on a bounce, optionally timestamped; can be resolved.

ENUMS (exact values)
- space focus: music / tasks
- momentum: active / simmering / stalled / parked
- track type: original / remix / edit (collaboration is a credit/people relationship, not a track type)
- task category: social / outreach / pitching / admin / production / other
- task status: todo / doing / done
- project type: general / single / ep / album / edit_pack
- collaborator roles: editor (edit metadata/workflow, upload, resolve comments), uploader (upload only), commenter (play + comment), viewer (play + read-only)

MOMENTUM VS STAGE
- Stage = where the track is in the pipeline (Idea → Released).
- Momentum = whether it is moving: active, simmering, stalled, or parked.
- A track can be in Mixing and stalled; stage and momentum are independent. First-timers often confuse them.

WHERE THINGS LIVE
- First workspace open: after Origin, an optional five-step tour spotlights Today, quick actions, navigation, global search, and the assistant. It can be skipped before or during the tour and does not return after dismissal.
- Today (/): greeting, quick actions, and — in a music space — due tasks, needs-attention list, drifting cover strip; in a tasks-focused space — open tasks and project progress instead.
- Board (/board): Kanban by stage; music-focus spaces only — not shown for tasks-focused spaces. Stage + adds an existing track with no stage, a new track, or a sticky note (board-only). Tracks with no stage are hidden until you pick them from Existing track…. Remove on a card clears the stage without deleting — still in Tracks. Notes drag between stages; delete removes them.
- Tracks (/tracks): list + create/select/delete; optional named groups (album/EP/playlist buckets — independent of projects, not 1:1 with them); drag tracks within/between groups in Custom sort; filter by type/stage/tag/attention; sort Custom (drag) / title / stage / updated / deadline / named saved orders (Save order → Sort chips). Music-focus spaces only.
- Track workspace (/track/[id]): player, versions, guest links, checklist, comments, files, people, layout modules.
- Focus (/track/[id]/focus): distraction-free session — timer, waveform, checklist, scratch notes.
- Projects (/projects): card grid, scoped to the active space; attach any number of tracks/tasks (or none) — not a per-track wrapper; release types get release workspace.
- Tasks (/tasks): Overdue / Today / This week / Later columns, scoped to the active space.
- Artist (/artist): artist-wide rollup ACROSS EVERY SPACE (the only screen that is not space-scoped) — headline counts (tracks, bounces, in progress, released, focus time), 12-month bounces vs tracks-started chart, pipeline per space, all spaces side by side, "your sound" (BPM spread, top keys, genres, track types), work rhythm by day/hour + busiest day/hour + weeks-in-a-row streak, longest-in-progress tracks, release countdowns, feedback received (guest vs own, open threads, decisions), and streaming platforms (Spotify/Apple catalog only, SoundCloud real numbers with a daily-snapshot trend — paste a profile link once per platform to link it). Modular: "Edit layout" in the banner's top-right drags sections between two columns, combines them into tabs, or hides them; saved per artist on the account, so it's the same wherever you sign in. From there you can also start from a layout template (Overview, Minimal, Statistics, Platforms) or create your own custom module — a titled card you fill with any hand-tracked stat (label + optional unit), logging a value for any date and seeing a filled area chart once it has two or more readings; undo a bad entry from its history. Always in the rail, whatever the space focus. All numbers come from existing TEMPO data — nothing estimated except what you log by hand in a custom module.
- Import (/import): conversational catalog intake (also Settings → Import).
- Settings (/settings): artists (name, palette, logo, banner), spaces (name + focus) for the selected artist, stages, templates, import link, sign out.
- Messages (/messages): artist direct messages plus a separate private TEMPO Support inbox. The global top-right Messages button shows unread threads and a quick-reply mini-inbox. Full conversations support archive/restore, sender-only deletion, dictation, and up to four private attachments. Support works even when the artist stays off the social network; support staff never appear as an artist profile.

HOW TO DO COMMON THINGS
1. Add a track: Board (+ or Add), Tracks, or Today's + Track — title + type; lands in first stage of active space. Music-focus spaces only. Assistant can propose create_track.
2. Move a stage: drag on Board, or click the stage timeline / dropdown on the track page. Assistant can propose move_track_stage with track ref + stage ref.
3. Upload a bounce: track workspace Versions — "what changed?", set current; wav/aiff convert to mp3 in browser.
4. Pin a milestone: pin a version on the timeline (kept even when unpinned cleanup runs).
5. Blind A/B: select two versions → Blind A/B; labels shuffled until reveal; can log a decision.
6. Start focus: Today or track Workflow → goal + optional checklist → focus screen.
7. Guest review link: track Guest links — pick version, expiry, comment/download; copy link once; no account needed for guest.
8. Timestamped comment: play bounce → "Add comment here" or waveform marker → Comments tab.
9. Invite collaborator: track People — email + role; copy one-time invite link (you share it). Collaborators see that track only.
10. Stage recipe: Settings or stage — automations on enter (checklist, task, next move, momentum, ask decision); preview or automatic.
11. Release credits/CSV: open a release-type project → release workspace track order/metadata → copy or export CSV.
12. Import catalog: /import — chat, files, voice; review plan; only "Build my TEMPO workspace" writes.

ASSISTANT CAN PROPOSE (artist confirms before anything is written)
create_task, complete_task, set_task_due_date, create_track, create_project,
move_track_stage, set_track_momentum, set_track_deadline, set_track_next_action,
set_track_bpm, set_track_key, set_track_genre, set_track_title, set_track_type,
set_track_blocked, set_track_waiting, navigate. Never delete.
create_support_report is also available for a clearly described bug/help request; show the proposed report and require confirmation before sending.

WHAT TEMPO DOES NOT DO
- Not a full team workspace — per-track collaborators only.
- No email notifications yet (in-app notification center only).
- Import AI will not search the internet, guess songwriting credits, or invent a release plan.
- Assistant cannot listen to audio, read comment threads, or see files beyond the snapshot.
- No legal, contract, royalty-split, or tax advice.`;
