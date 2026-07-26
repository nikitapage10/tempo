# TEMPO — Product overview

*This document describes TEMPO as it exists today. It is updated whenever the product changes.*

## What TEMPO is

TEMPO is a web app for managing a musician’s work from idea through release and beyond — not only production stages, but also the pitching, social posts, edit packs, and follow-ups that surround a track. It is a dark, studio-feeling workspace you open in a browser (phone or desktop), with your account and data living in the cloud so nothing depends on one machine.

## Who it’s for

A solo working artist who wants one place for tracks, projects, and tasks instead of a spreadsheet, notes app, and scattered files. Right now TEMPO is single-user: you sign in with your email and manage your own catalog.

## The big ideas

Three kinds of things will eventually sit at the center of TEMPO: **tracks** (a musical work with stages, versions, and notes), **projects** (containers like an EP or edit pack), and **tasks** (actionable items that may or may not belong to a track or project). Progress is meant to feel honest — stage and “momentum” matter as much as checklist percentages — and every bounce you upload should become an immutable version rather than overwriting the last file.

Today those ideas are designed and sketched in the app’s navigation, but most of the day-to-day workflow is still coming. What ships now is the foundation: sign-in, the dark studio shell, and labeled places for Today, Board, Tracks, Projects, Tasks, and Settings.

## Current feature set

**Sign-in.** You open the live site, go to sign-in, enter your email, and receive a magic link — no password. Opening the link on that device signs you in. You can sign out from Settings.

**App shell.** Once signed in you get TEMPO’s dark UI: a left rail on desktop (Today, Board, Tracks, Projects, Tasks, plus Settings) and a bottom tab bar on phone (Today, Board, Tasks, and a reserved Add control that does not create anything yet). Branding, type, and the thin ice-to-amber accent line match the intended studio look.

**Placeholder screens.** Today, Board, Tracks, Projects, and Tasks each open with a short “coming soon” style message. You can navigate between them, but you cannot yet create tracks, drag cards on a board, manage spaces, upload audio, log sessions, or run a task list. Settings currently only covers signing out; spaces, stages, and templates are not configurable in the UI yet.

**Spaces (not live yet).** The rail shows a disabled “Originals” space switcher as a preview of multi-workspace support. Switching spaces and editing stages is not available.

**Backend ready for the rest.** The cloud database and private audio storage are set up for the full product (spaces, stages, tracks, versions, assets, checklists, templates, tasks, session log). The app does not yet expose those capabilities in the interface.

## How it’s hosted

The live app is at **https://tempo-ten-sigma.vercel.app** (sign-in at `/login`). Pushes to the main branch deploy there automatically. Local development is for building and testing; anything that ships uses the production address for absolute links, not localhost.
