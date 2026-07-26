# PROMPTS.md — Paste these into Cursor one at a time, in order

Rules for you (the human): one prompt per work package. Test with the checklist
before moving to the next. If something's broken, describe exactly what you saw
(screenshots help) and let Cursor fix it before continuing.

---

## Prompt 1 — Scaffold, design system, auth, app shell

```
Read tempo-design-spec.md and .cursorrules fully before doing anything.

Work package 1: scaffold the project.

1. Initialize a Next.js 14+ App Router project with TypeScript (strict) and
   Tailwind in THIS folder (don't create a nested folder). Init shadcn/ui.
2. Set up the design system from spec §5: all CSS variables in globals.css,
   Tailwind config mapped to them, Google Fonts (Space Grotesk, Inter,
   JetBrains Mono) via next/font, and a .flare-line utility class.
3. Install: @supabase/supabase-js @supabase/ssr @tanstack/react-query
   @dnd-kit/core @dnd-kit/sortable wavesurfer.js
4. Create lib/supabase (browser + server clients reading
   NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY), and
   lib/storage.ts stub per .cursorrules.
5. Auth: magic-link sign-in page; middleware protecting all app routes;
   sign-out in settings. Style the sign-in page per the design system with
   a static ice→amber gradient edge strip (no WebGL yet).
6. App shell per spec §6: left rail (wordmark "TEMPO" + flare-line, space
   switcher placeholder, nav: Today / Board / Tracks / Projects / Tasks,
   settings at bottom), 2px static gradient strip at viewport top, content
   area. Mobile: bottom tab bar. Placeholder pages for each nav item.
7. Create .env.local.example listing the two env vars, ensure .env.local is
   gitignored, then tell me exactly what to put in .env.local.

When done, give me a manual test checklist.
```

---

## Prompt G — Push to GitHub (run once, after Prompt 1 works)

```
Initialize git if needed, create a sensible .gitignore, commit everything as
"initial scaffold", create a private GitHub repo called tempo using the gh CLI
(walk me through gh auth login if I'm not authenticated), and push to main.
```

---

## Prompt 2 — Spaces, stages, board

```
Work package 2 per tempo-design-spec.md §3 and §6.2: Spaces and the Kanban board.

1. Spaces CRUD (create/rename/delete/reorder) with a working space switcher in
   the rail. On a user's first login, seed two spaces: "Originals" and
   "Edits & Remixes", each with default stages: Idea, Writing, Production,
   Mixdown, Master, Release Prep, Released.
2. Stage editor (per space): add, rename, reorder (drag), delete — deleting a
   stage with tracks asks where to move them.
3. Tracks: create modal (title + type required, everything else optional and
   collapsible), edit, archive/delete with confirm.
4. Board page: horizontal-scroll Kanban of stages for the active space.
   Track cards per spec §3 MVP (title, type badge chip, BPM · key in mono,
   momentum dot, deadline if set, artwork thumb or gradient placeholder
   derived from track id). @dnd-kit drag between stages with optimistic
   updates. Column headers show stage name + mono count; empty board shows
   an inviting empty state per spec §5 voice.
5. Filter chips on the board: by type and tag.

Use React Query for all data. Manual test checklist when done.
```

---

## Prompt 3 — Track workspace: metadata, checklist, templates, notes

```
Work package 3 per tempo-design-spec.md §6.3: the track detail page (everything
except audio, which is next).

1. Route /track/[id]. Header band: artwork or gradient placeholder, inline-
   editable title, mono meta line (BPM · key · version count · type), momentum
   selector (Active/Simmering/Stalled/Parked), stage dropdown, deadline picker.
2. Two-column layout per spec (stacks on mobile). Right column: Checklist,
   Stems & assets (placeholder for now), Notes (freeform, autosaving),
   Details (remaining metadata fields: artist alias, genre, destination, tags).
3. Checklist: add/edit/toggle/reorder/delete items; thin ice→amber progress
   bar computed from items; "Apply template" dropdown; "Save as template".
4. Seed 4 built-in templates on first login: Arrangement, Mixdown, Master Prep,
   Release Prep (invent 5-8 sensible producer items each).
5. Left column placeholders for Player / Versions / Session log with
   empty-state copy.

Manual test checklist when done.
```

---

## Prompt 4 — Audio: versions, player, stems, session log

```
Work package 4 per tempo-design-spec.md §3, §4, §6.3: audio. Read the storage
and database rules in .cursorrules first — versions are append-only and
file paths/signed URLs must go through lib/storage.ts.

1. Implement lib/storage.ts fully against the private Supabase bucket "audio".
2. Version upload: drop-zone + button accepting mp3/wav/aiff/m4a with a
   "what changed?" field. Each upload inserts a versions row (DB trigger
   numbers it), marks it current, shows upload progress, and handles errors
   with actionable messages. Client-side max 200 MB with a clear error.
3. Versions list, newest first: v-number in mono (amber if current), label,
   changelog, date, size, actions: play, set current, download (signed URL),
   delete with strong confirm.
4. Player at top of left column: wavesurfer.js waveform of the current (or
   selected) version — waveform in --text-lo, progress in ice→amber gradient —
   play/pause, elapsed/total in mono, version dropdown to A/B versions.
5. Stems & assets: upload to assets by kind (stem/midi/artwork/lyrics/
   reference/other), grouped list, download via signed URL, delete.
   Uploading kind=artwork sets the track's artwork thumbnail.
6. Session log: "Log session" one-field composer; entries reverse-chron;
   if a version was uploaded today, offer to link it.

Manual test checklist when done — include uploading a real wav and mp3.
```

---

## Prompt 5 — Tasks, projects, Today dashboard

```
Work package 5 per tempo-design-spec.md §3, §6.1, §6.4, §6.5.

1. Tasks page: inline quick-add; fields per schema (title, category chip,
   status, due date, optional link to track or project, notes). Grouped:
   Overdue / Today / This week / Later. Filters by category/status. Linked
   track/project shows as a chip that deep-links.
2. Projects: card grid (name, deadline, member counts, aggregate checklist %);
   detail page with description, attached tracks as compact rows, attached
   tasks. Attach/detach existing tracks and tasks from the detail page.
3. Today page (make it the default landing after sign-in): contained banner
   with greeting, date, and three mono stats (active tracks, tasks due this
   week, sessions this week) over a static ice→amber gradient with a black
   scrim per spec §5. Below: two columns — "Tasks due" (checkable, overdue
   in --warn) and "In motion" (momentum=Active tracks: thumb, title, stage,
   last session date). Quick actions: + Track, + Task, Log session.

Manual test checklist when done.
```

---

## Prompt 6 — Shader theme moments + polish

```
Work package 6 per tempo-design-spec.md §5: the Spectra visual moments, then
polish. Performance guardrails in spec §5 are mandatory.

1. Create components/shader-lines.tsx by adapting
   reference/shader-lines-original.tsx — read that file first; it contains
   the exact GLSL fragment shader that defines the look, plus a comment
   block listing every required change (npm three instead of the CDN script,
   PlaneGeometry + OrthographicCamera instead of the removed r89 APIs,
   modern uniform format, fixed cleanup). Keep the fragment shader GLSL
   byte-for-byte identical. Props: className, intensity, speed. Pause rAF
   when tab hidden or element offscreen (IntersectionObserver); cap
   devicePixelRatio at 2; static gradient fallback when WebGL is
   unavailable; render nothing animated under prefers-reduced-motion.
2. Intro moment on sign-in/app load: full-bleed shader behind the TEMPO
   wordmark for ~1.2s, then collapse (scale-Y toward center) into the top
   edge strip. Runs once per session (sessionStorage flag). Skipped entirely
   under prefers-reduced-motion.
3. Replace the static top edge strip with the shader cropped thin at ~40%
   opacity (desktop only; keep static gradient on mobile for battery).
4. Empty states for Board and Today get a contained shader panel with copy
   on a solid scrim per spec §5.
5. Polish pass: keyboard focus rings (2px ice) everywhere, mobile layout
   audit of all pages, loading skeletons, error toasts, favicon + PWA
   manifest (installable, dark theme color #0A0A0C).

Manual test checklist when done — include: reduced-motion on, tab hidden
(CPU should drop), mobile width, and installing the PWA on a phone.
```

---

## After MVP: everyday change requests

Just describe what you want in plain language, e.g.:

- "On the board, let me filter by BPM range."
- "Add a 'duplicate track' action that copies metadata and checklist but not versions."
- "The waveform is too short on mobile — make the player taller."

For risky/big changes, start with:
"Create a branch called experiment for this work." — then merge only when the
Vercel preview URL looks right.
