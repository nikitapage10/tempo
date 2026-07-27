# CHANGELOG

Plain-English history of what changed in TEMPO, newest first.

## 2026-07-26

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
