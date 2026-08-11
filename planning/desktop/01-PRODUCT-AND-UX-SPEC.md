# TEMPO Desktop — product and UX spec

Written for the product owner. No file paths or component names except where
an existing TEMPO surface is being extended, in which case it's named the way
an artist would recognize it.

## What this adds

Today TEMPO is a web app you open in a browser, installable as a lightweight
shortcut but still entirely dependent on the internet for every screen, every
piece of artwork, and every second of audio. TEMPO Desktop is a real
installed application for Windows and Mac that:

- Opens instantly from local disk — no waiting on a network connection to
  paint the app itself.
- Keeps a **complete local copy of every bounce you've ever uploaded**, not
  just the two most recent ones TEMPO currently keeps in the cloud.
- Keeps your artwork, logos, and covers stored locally too, so they load
  without a round trip.
- Quietly syncs in the background — new bounces or catalog changes made on
  the web (or on another computer) show up in the desktop app without you
  having to do anything, even before you've opened it that day.
- Lets you keep working on your Board, Tracks, Projects, Tasks, and Calendar
  with no internet connection at all — on a plane, in a studio with no wifi —
  and catches everything up once you're back online.

Everything else about TEMPO — settings, permissions, sign-in, collaborators,
Social, Messages, the assistant — behaves exactly as it does today and
requires a connection, exactly as it does today.

## The platform handoff

A quiet control sits in the left rail directly above Settings. It reads:

- **Download for Windows** or **Download for Mac** — detected from your
  browser, shown when you're using TEMPO in a browser and don't have the
  desktop app connected to your account yet.
- **Open in desktop** — shown once TEMPO knows the desktop app is installed
  and signed into this account (see below for how it knows), which opens the
  desktop app directly instead of offering another download.
- **Open web app** — when you're already using TEMPO *inside* the desktop
  app, opening the same screen in the system browser.

One honest limitation: a website cannot see what's installed on your
computer. "Open in desktop" isn't guessed from your browser — it appears
because the desktop app itself told your account it exists, the first time
you sign into it. Until you've installed and signed in once, the web app
always offers the download.

## The download page

A plain page, reachable from that button, with:

- One button per OS with the current version and file size.
- What the desktop app adds over the web app (the bullet list above, in
  shorter form).
- System requirements (OS versions supported).
- **Beta install notice.** These builds aren't code-signed yet, so Windows
  SmartScreen and macOS Gatekeeper will both warn you before the first run.
  The page walks through exactly what to click through on each OS — this is
  expected, not a sign anything's wrong, and goes away once builds are signed.

## First run

1. Sign in — the same email/password or Google/Microsoft sign-in as the web
   app.
2. Choose where your local TEMPO folder lives (a sensible default is offered,
   changeable anytime later from Settings).
3. Initial sync — a progress screen while your catalog, artwork, and bounce
   history come down for the first time. Larger catalogs take longer; you can
   dismiss this and keep working while it finishes in the background, with a
   quiet indicator until it's done.

## Bounce history, now unbounded

The version timeline on a track page looks and works the same as it does
today, with one addition: each version carries a small badge showing where it
lives —

- **On this computer** — the full file is in your local vault; plays and
  downloads instantly, no connection needed.
- **In the cloud** — not yet mirrored locally; plays like it does in the web
  app today (a moment to fetch, needs a connection). Only ever the newest
  version and the one before it are in this state for very long.
- **On another computer** — you have another desktop install where this
  bounce lives locally, but not on this one; one click pulls it down.

There is no cap on how many versions the desktop app keeps. Upload, upload,
upload — every bounce stays in your local history forever, the way TEMPO
today keeps only pinned milestones plus your two newest. Milestones and
decisions work exactly as they do today; pinning still matters for what shows
up highlighted in the timeline, it just no longer determines what gets
deleted.

## Storage screen

A new panel under Settings, desktop only:

- Total size of your local vault, and where it lives on disk.
- A quick sense of what's taking the space (bounces vs. artwork).
- Re-download any bounce that's cloud-only back onto this computer.
- Move the vault to a different folder or drive.
- What happens if TEMPO can't find the folder (moved, renamed, or the drive is
  unplugged): TEMPO says so plainly, keeps working against the cloud in the
  meantime, and offers to relocate or rebuild the vault rather than silently
  losing track of it.

## Background sync

A setting, **on by default**: *Keep TEMPO syncing in the background.*

With it on, closing the TEMPO window doesn't quit the app — it steps back to
a small icon in your system tray (Windows) or menu bar (Mac), and TEMPO keeps
watching for new bounces, artwork, and catalog changes and pulling them down
quietly. TEMPO also opens itself automatically after your computer starts up,
so this stays true across restarts without you doing anything. The tray icon
shows a small state — synced, syncing, or a connection problem — and gives you
Open TEMPO and Quit TEMPO from a right-click menu.

Turn the setting off and TEMPO behaves the way you'd expect a normal
application to: closing the window quits it, and it catches up on whatever
changed the next time you open it.

**What this does and doesn't cover, plainly stated:** background sync means
that when you open TEMPO, it's usually already caught up — not that TEMPO
keeps working after you've fully quit it (via Quit TEMPO, not just closing the
window). That's a further step this program deliberately doesn't take yet;
see the technical document for why.

## Offline

Five screens keep working with no connection: **Board, Tracks, Projects,
Tasks, and Calendar** — read and write. A small, calm banner appears when
you're offline, and changes you make are marked as **pending** until TEMPO
reconnects and sends them, at which point the banner and the marks clear on
their own. If you're on the desktop app and offline, you can still play any
bounce that's already in your local vault.

Five screens don't work offline, and say so rather than showing stale or
broken data: **Artist, Social, Scenes, Stats, and Messages**, plus the
floating assistant and Import. Opening one while offline shows a plain
message — *This needs an internet connection* — instead of an error or a
blank page.

**If two changes conflict** — you edited a task's due date offline, and it
also changed on the web before you reconnected — TEMPO keeps both changes
visible and asks you which one should stick, rather than silently picking one
or throwing the conflict away. This should be rare in practice, since it only
happens if the same field on the same item was touched from two places before
either had a chance to sync.

## What this deliberately is not

- Not a second copy of the database — Supabase in the cloud remains the
  source of truth for everything except your local bounce vault.
- Not a general file-sync tool — only TEMPO's own tracks, artwork, and
  bounces are mirrored, nothing else on your computer.
- Not full offline collaboration — a collaborator's changes while you're both
  offline aren't visible to each other until both reconnect.
- Not an offline assistant — the assistant needs a connection, same as today.
- Not (yet) something that keeps syncing after you've fully quit the app —
  see Background sync above.

## Copy and accessibility

- Studio-casual wording throughout, consistent with the rest of TEMPO ("Your
  bounces, on this computer," not "Local cache synchronized").
- The download button, tray icon, and offline banner all carry accessible
  labels and are operable by keyboard.
- The tray icon's state changes and the sync progress indicator respect
  reduced-motion preferences the same way the rest of TEMPO's motion does —
  no animated spinners for users who've asked to avoid them; a static state
  indicator instead.
- Errors (sync failure, missing vault folder, conflict) surface as the same
  short, plain-language toasts TEMPO already uses, with a clear next step.
