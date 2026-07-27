# TEMPO — Product overview

*This document describes TEMPO as it exists today. It is updated whenever the product changes.*

## What TEMPO is

TEMPO is a web app for managing a musician’s work from idea through release and beyond — not only production stages, but also the pitching, social posts, edit packs, and follow-ups that surround a track. It is a dark, studio-feeling workspace you open in a browser (phone or desktop), with your account and data living in the cloud so nothing depends on one machine. You can install it as an app on your phone or computer (PWA) with the same dark look.

## Who it’s for

A solo working artist who wants one place for tracks, projects, and tasks instead of a spreadsheet, notes app, and scattered files. Right now TEMPO is single-user: you sign in with your email and manage your own catalog.

## The big ideas

Three kinds of things sit at the center of TEMPO: **tracks** (a musical work with stages, versions, and notes), **projects** (containers like an EP or edit pack), and **tasks** (actionable items that may or may not belong to a track or project). Progress is meant to feel honest — stage and “momentum” matter as much as checklist percentages — and every bounce you upload becomes an immutable version rather than overwriting the last file.

## Current feature set

**Sign-in.** You open the live site, go to sign-in, enter your email, and receive a magic link — no password. Opening the link on that device signs you in. You can sign out from Settings. On first load of a session you may see a short Spectra light intro behind the TEMPO wordmark (skipped if you prefer reduced motion).

**App shell.** Once signed in you land on **Today**. Desktop has a left rail (Today, Board, Tracks, Projects, Tasks, plus Settings) and a thin animated light strip along the top; phone uses a bottom tab bar (Today, Board, Tasks, plus Add). Under Settings in the rail, the current app version is shown in small mono type.

**Today.** A greeting banner shows the date and three quick counts: active tracks, tasks due this week, and sessions this week. Below: **Tasks due** (checkable, overdue in warm red) and **In motion** (tracks marked Active, with stage and last session). Quick actions: + Track, + Task, Log session. An empty Today uses a contained light panel with a short invite.

**Spaces.** On first sign-in TEMPO creates two workspaces: **Originals** and **Edits & Remixes**, each with a default stage pipeline. Switch spaces from the rail; manage them in Settings. First sign-in also seeds four checklist templates.

**Board.** Horizontal Kanban for the active space: drag tracks between stages, filter by type and tag, tap a card to open the track workspace. Empty boards get the same Spectra empty panel as Today.

**Tracks.** Create with title and type (more details optional). The Tracks page lists everything in the active space.

**Track workspace.** Header with artwork or gradient, editable title, mono meta line, momentum, stage, and deadline. Left column: waveform player (current or selected version, A/B via dropdown), version history (upload with “what changed?”, set current, download, delete), and session log. Right column: checklist (templates, progress bar), stems & assets by kind, notes, and details. Uploading artwork sets the track thumbnail. Audio lives in private cloud storage and plays via time-limited links.

**Tasks.** Global list with quick-add, category chips, status, due date, optional link to a track or project, and notes. Grouped into Overdue / Today / This week / Later; filters by category and status. Linked items show as chips that jump to the track or project.

**Projects.** Card grid showing name, deadline, track/task counts, and combined checklist %. Open a project to edit description and deadline, and attach or detach existing tracks and tasks.

**Checklists & templates.** Arrangement, Mixdown, Master Prep, and Release Prep ship on first login. Apply a template to a track or save any checklist as a new template.

**Look & feel.** Dark Spectra palette (ice for interaction, amber for “current” / status). Thin prismatic light appears only as intro, top edge, empty states, and the Today banner atmosphere — never as a full-page background behind dense data. Keyboard focus uses a clear ice ring. Errors surface as short toasts with what to try next.

## How it’s hosted

The live app is at **https://tempo-ten-sigma.vercel.app** (sign-in at `/login`). Pushes to the main branch deploy there automatically. For local work on a Mac, double-click **Launch TEMPO.command** in the project folder — it starts a local server and opens the app in your browser (keep that Terminal window open; Ctrl+C stops it). Local development uses your `.env.local` keys; anything that ships uses the production address for absolute links, not localhost.
