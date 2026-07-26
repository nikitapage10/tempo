# TEMPO — Product overview

*This document describes TEMPO as it exists today. It is updated whenever the product changes.*

## What TEMPO is

TEMPO is a web app for managing a musician’s work from idea through release and beyond — not only production stages, but also the pitching, social posts, edit packs, and follow-ups that surround a track. It is a dark, studio-feeling workspace you open in a browser (phone or desktop), with your account and data living in the cloud so nothing depends on one machine.

## Who it’s for

A solo working artist who wants one place for tracks, projects, and tasks instead of a spreadsheet, notes app, and scattered files. Right now TEMPO is single-user: you sign in with your email and manage your own catalog.

## The big ideas

Three kinds of things sit at the center of TEMPO: **tracks** (a musical work with stages, versions, and notes), **projects** (containers like an EP or edit pack), and **tasks** (actionable items that may or may not belong to a track or project). Progress is meant to feel honest — stage and “momentum” matter as much as checklist percentages — and every bounce you upload should become an immutable version rather than overwriting the last file.

Today, spaces and the Kanban board are live so you can organize tracks by workflow stage. Track detail (versions, audio, checklists), projects, and the full Today dashboard are still coming.

## Current feature set

**Sign-in.** You open the live site, go to sign-in, enter your email, and receive a magic link — no password. Opening the link on that device signs you in. You can sign out from Settings.

**App shell.** Once signed in you get TEMPO’s dark UI: a left rail on desktop (Today, Board, Tracks, Projects, Tasks, plus Settings) and a bottom tab bar on phone (Today, Board, Tasks, plus Add, which opens a new track on the board). Under Settings in the rail, the current app version is shown in small mono type. Branding, type, and the thin ice-to-amber accent line match the intended studio look.

**Spaces.** On first sign-in TEMPO creates two workspaces for you: **Originals** and **Edits & Remixes**. Each comes with a default stage pipeline (Idea → Writing → Production → Mixdown → Master → Release Prep → Released). The rail space switcher lets you jump between spaces. In Settings you can create, rename, reorder (drag), and delete spaces — deleting a space removes its stages and tracks, with a confirm step. New spaces get the same default stages.

**Board.** The Board page is a horizontal Kanban for the active space. Column headers show the stage name and a track count. Cards show title, type badge, BPM and key in mono when set, a momentum dot, deadline if set, and artwork or a color placeholder. Drag a card between stages; the move saves immediately. Filter chips narrow the board by track type and by tag. An empty board invites you to start a track. Use **Stages** on the board to add, rename, drag-reorder, or delete stages; if a stage still has tracks, you choose where those tracks should move.

**Tracks.** Create a track with title and type (everything else is optional and tucked under “More details”). Edit from the board or the Tracks list. Park a track (sets momentum to parked) or delete it with a confirm. The Tracks page lists everything in the active space.

**Still coming.** Today, Projects, and Tasks remain placeholder screens. Track workspace (versions, player, checklist, session log) and audio uploads are not built yet.

## How it’s hosted

The live app is at **https://tempo-ten-sigma.vercel.app** (sign-in at `/login`). Pushes to the main branch deploy there automatically. Local development is for building and testing; anything that ships uses the production address for absolute links, not localhost.
