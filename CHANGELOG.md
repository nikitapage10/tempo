# CHANGELOG

Plain-English history of what changed in TEMPO, newest first.

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
