# TEMPO — Artist Origin (ORIGIN) Onboarding Spec

*Feature spec for a self-contained build. Read `CLAUDE.md` and `.cursorrules`
first — this doc assumes and extends those rules, it does not replace them.*

> **Status: implemented, not yet verified against a live signed-in session.**
> Type-check and production build are clean. Migration `042_artist_origins.sql`
> **must be run in Supabase before the feature works** — until then the app
> behaves exactly as it did before (see *Un-migrated behaviour*).

## Product intent

ORIGIN is TEMPO's first-time artist onboarding. It is not a setup wizard, a
questionnaire, a tutorial, or a personality test. TEMPO begins dormant, senses
an artist arriving, listens to them, reflects an initial shape back, and opens
that signal into a larger creative world.

The emotional premise: **"Every story begins with a pulse."**

Narrative arc: PULSE → PRESENCE → RECOGNITION → LISTENING → INTERPRETATION →
FORMATION → THE CHAPTER OPENS → ENTER TEMPO.

The generated interpretation is **provisional and editable**. TEMPO reflects
what the artist deliberately provided. It does not diagnose them, define them
permanently, research them online, or claim to know them better than they do.
**Nothing created during Origin is public by default.**

## Media

Ten videos and six posters live in `public/onboarding/origin/`. The sequence
mapping is authoritative and does **not** follow alphabetical order of the
delivered filenames.

| Role | Delivered as | Served as |
|---|---|---|
| Opening, Frame 1→2 | `first trans.mp4` | `opening-01-02.mp4` |
| Frame 2 name loop | `2 Loop.mp4` | `loop-02.mp4` |
| Recognition, 2→3 | `second trans.mp4` | `transition-02-03.mp4` |
| Frame 3 listening loop | `3 loop.mp4` | `loop-03.mp4` |
| Interpretation, 3→4 | `third trans.mp4` | `transition-03-04.mp4` |
| Frame 4 processing loop | `4 loop.mp4` | `loop-04.mp4` |
| Resolution, 4→5 | `4 trans.mp4` | `transition-04-05.mp4` |
| Frame 5 review loop | `5 loop.mp4` | `loop-05.mp4` |
| Chapter opening, 5→6 | `fifth trans.mp4` | `transition-05-06.mp4` |
| Frame 6 scroll scrub | `6 scroll.mp4` | `scroll-06.mp4` |

All are 1920×1080, h264, 24 fps, and carry an AAC track that is never played —
every element mounts `muted`.

### Delivery inspection and the two encodes

| Asset | Duration | Size | Bitrate |
|---|---|---|---|
| `opening-01-02` | 6.06s | 4.5 MB | 5.8 Mbps |
| `loop-02` | 5.06s | 1.6 MB | 2.5 Mbps |
| `transition-02-03` | 4.06s | 1.9 MB | 3.6 Mbps |
| `loop-03` | 6.08s | 6.6 MB | 8.6 Mbps |
| `transition-03-04` | 5.06s | **11.2 MB** | **17.5 Mbps** |
| `loop-04` | 6.08s | 2.1 MB | 2.6 Mbps |
| `transition-04-05` | 6.06s | 4.2 MB | 5.4 Mbps |
| `loop-05` | 6.08s | 6.8 MB | 8.8 Mbps |
| `transition-05-06` | 6.06s | 4.6 MB | 5.9 Mbps |
| `scroll-06` | 10.05s | 10.9 MB | all-intra |

**Faststart remux (applied).** All ten arrived with `moov` at the end of the
file, meaning a browser needed a second round-trip to the tail before it could
render a first frame. Remuxed with `-c copy -movflags +faststart`; the video
streams hash identical before and after, so this cost nothing in quality.

**All-intra re-encode of `scroll-06` (applied).** As delivered it had **one
keyframe across 241 frames**, so every seek replayed the file from the start and
scrub latency scaled linearly with position:

| Seek to | 10% | 30% | 50% | 75% | 90% |
|---|---|---|---|---|---|
| As delivered | 195ms | 453ms | 868ms | 1244ms | 1531ms |
| All-intra | 14ms | 14ms | 7ms | 9ms | 7ms |

Re-encoded `-g 1 -keyint_min 1 -sc_threshold 0 -crf 25`, measured SSIM 0.985
against source. 5.9 MB → 10.9 MB. The original is preserved beside it as
`scroll-06-source.mp4`. **The scroll chapter does not work without this** — no
amount of buffering or seek throttling compensates for sparse keyframes.

**`transition-03-04` is an outlier** at 3× the bitrate of every other clip. It
preloads during the ~30s speaking window so it fits the budget, but a CRF
re-encode would cut it to roughly 3 MB with no visible difference. Not done —
it needs the product owner's eye.

### Posters

`frame 6 second option.png` **was not present** in the delivered folder. Posters
`frame-01` … `frame-06` are first frames extracted with ffmpeg (`-frames:v 1`,
no modification to any video stream); `frame-06` is the first frame of
`scroll-06`, which is the frame the chapter opens on anyway.

## First-run routing

Before: REGISTER → BRING YOUR MUSIC IN → TEMPO
Now: **REGISTER → ORIGIN → BRING YOUR MUSIC IN → TEMPO**

`/origin` lives in the `(onboarding)` route group, outside the app shell — no
rail, no toolbar, no search, no notifications, no assistant, no boot intro.
Origin *is* the introduction.

Whether Import is still owed is read server-side from `onboarding_imports`: a
row with status `completed` or `cancelled` means dealt with. There is no
separate skip flag, so Origin does not invent one — it routes into Import unless
Import has already been handled.

- **Existing users are never redirected.** Artists predating the feature are
  backfilled to `legacy_complete`.
- **Switching artists never hijacks anyone** into onboarding. The guard only
  redirects *out* of `/origin`, never into it.
- Settings → **Artist Origin** offers "Open Artist Origin" (revisit, straight
  into the editable story) and "Replay introduction" (the full film).

## Persistence

Migration `042_artist_origins.sql`, additive only.

`artists` gains `origin_status` (`not_started` / `in_progress` / `complete` /
`skipped` / `legacy_complete`), `origin_completed_at`, `origin_skipped_at`. The
column is added nullable, backfilled to `legacy_complete`, defaulted to
`not_started`, then set NOT NULL.

`artist_origins` is one owner-private row per artist holding the draft and the
confirmed content. Plain text and structured JSON only — never generated HTML.

**Security.** RLS is owner-only and checks *both* `artist_origins.user_id` and
the owning `artists.user_id` against `auth.uid()`, so a guessed artist UUID from
another account reaches nothing. A `CHECK` constraint additionally forbids a row
whose `user_id` disagrees with the artist's owner, closing the gap where a
caller inserts their own `user_id` against someone else's `artist_id`.

`complete_artist_origin()` runs the whole completion as one transaction and is
**idempotent** — a second call lands on the same state and does not move
`completed_at`. It deliberately never touches `artist_profiles`: publishing,
visibility, and Social stay exactly where the artist left them.

Draft saves are debounced (900ms) and fire-and-forget: a failed autosave never
interrupts the experience, because nothing is lost from memory.

## State machine

`lib/origin/reducer.ts`. Phases: `booting`, `opening`, `name_idle`,
`recognizing`, `introduction_idle`, `recording`, `interpreting_transition`,
`processing`, `resolving`, `review`, `chapter_opening`, `story_scroll`,
`saving`, `complete`, `recoverable_error`.

**Media timing and API timing are separate clocks.** Leaving the processing loop
requires *both* `transitionSettled` (the covering transition played to its end)
and `interpretationReady` (the request returned). A fast model response is
therefore harmless — the transition is never cut short.

**Resume never lands mid-transition.** Saved steps map to stable loops: name →
`loop-02`, introduction → `loop-03`, processing → `loop-04`, review →
`loop-05`, story → `scroll-06`.

**Regeneration never destroys the current version.** A new interpretation is
held in `pendingInterpretation` until the artist accepts it, and edits push onto
a five-deep session undo stack.

## Preloading and handoffs

`lib/origin/readiness.ts` + `hooks/use-origin-media.ts`.

Readiness is derived from `readyState` plus real `video.buffered` ranges, never
from `canplaythrough` alone. Assets are warmed by detached muted video elements
pointed at the same URLs the visible elements use, so the browser's ordinary
HTTP cache does the sharing — one fetching mechanism, no Blob URLs, nothing held
in JS memory.

Staged chain — each phase warms what the *next* interaction needs:

| While showing | High priority | Background |
|---|---|---|
| opening | `loop-02` | — |
| name | `transition-02-03`, `loop-03` | — |
| introduction / recording | `transition-03-04`, `loop-04` | `scroll-06` |
| processing | `transition-04-05`, `loop-05` | `scroll-06` |
| review | `transition-05-06`, `scroll-06` | — |

Gating is always on the **destination**, never on what is currently playing.
Background work never runs while a high-priority asset is in flight. A *failed*
asset counts as settled, so a broken file cannot deadlock the flow.

**Handoff contract** (`origin-media-stage.tsx`): exactly two `<video>` elements,
identical full-screen geometry, over an opaque poster floor. The destination is
loaded into the standby, played while invisible, and only swapped once
`requestVideoFrameCallback` confirms a painted frame (2.5s timeout fallback).
The outgoing element is released 180ms later, after the 140ms crossfade — so the
page background is never exposed and no black frame appears between clips.

## Scroll-scrubbed story

`hooks/use-origin-scroll-scrub.ts`. Native scrolling only — no wheel
interception, no `preventDefault`, no document translation, no GSAP. A tall
container scrolls normally, a sticky stage holds the video, and scroll position
maps to `currentTime` inside one `requestAnimationFrame` loop with passive
listeners. Continuous progress lives in a ref and never enters React state;
React is told only when the chapter changes. `fastSeek()` where supported.

Five chapters at 0 / 18 / 42 / 66 / 88 %: The first shape · What came through ·
Your creative compass · The chapter you are opening · The beginning.

## AI grounding

`POST /api/artist-origin/interpret`, server-only, `IMPORT_MODEL`, strict JSON
Schema, `friendlyAIError` for safe messages. Ownership is verified against
`artists` before the model is called, so a guessed UUID cannot spend tokens.
The route writes nothing — the artist edits first, and the review step saves.

The prompt forbids: internet lookup, treating a recognised name as a real
artist, inventing achievements/releases/collaborators/influences, inferring race,
ethnicity, religion, sexuality, gender identity, disability, health, trauma or
politics, diagnosing personality, and predicting success. Every signal must
carry evidence traceable to the artist's own words; genres and roles are left
empty rather than guessed. Output is sanitized server-side again after strict
mode, because strict mode fixes shape, not length.

## Speech

`hooks/use-origin-speech.ts` reuses the two-path architecture already in Import:
live Web Speech where available, `MediaRecorder` → `/api/assistant/transcribe`
otherwise. Shaped for one long take: no forced stop, elapsed clock, pause,
resume, restart, ~10 min cap. Typing is a first-class equal path, and the
transcript survives every error. **Raw audio is never retained** — the blob
exists only long enough to transcribe. The microphone is released on every exit
path including unmount.

Privacy copy: *"Your words are sent to be transcribed and interpreted. The
recording itself is not kept. Nothing is published without your confirmation."*

## Reduced motion, Save Data, slow networks

`prefers-reduced-motion` or `saveData` puts the flow in **static mode**: no
video is mounted at all, posters carry the visuals, transitions are skipped, the
story renders as ordinary stacked sections, and every action stays completable.
`slow-2g`/`2g` suppresses all speculative prefetch. Media gates auto-open in
static mode so nothing waits on a file that will never load.

## Profile mapping

Opt-in, unchecked by default. Fills **only empty** fields — promise → `tagline`,
compass + chapter premise → `bio`. Never passes `visibility`, never touches
handle, location, pronouns, links, or messaging settings, never enables Social,
and does not write genres or roles (those need their own confirmation). A
failure is swallowed: the artist has finished Origin and must not be blocked
from entering by an optional nicety.

## The seam into the product

`first-open-reveal.tsx` sets two session flags on completion. The app shell
mounts an opaque layer showing the chapter's final frame, lets the destination
render underneath, fades to deep black over ~850ms, and clears itself. The daily
boot intro is suppressed for that session in all three places that gate it
(`introWillPlay`, the pre-paint inline script, and `IntroMoment`) so the artist
never gets two introductions back to back.

## Un-migrated behaviour

Until `042` is run, `origin_status` reads as `null`, which the guard treats as
**done** — an un-migrated database never traps anyone in a flow that cannot
save. Registration still redirects to `/origin`, which immediately forwards to
`/import`, preserving today's behaviour exactly.

## Acceptance checklist

Not yet executed — needs a signed-in session against a migrated database.

- [ ] Fresh account: Origin opens before Import; boot intro does not play
- [ ] Opening plays without waiting for the whole sequence; copy in order
- [ ] Every transition hands off with no black frame or visible seam
- [ ] Name validates; draft survives refresh
- [ ] Live dictation, record-and-transcribe, and typing all work
- [ ] Microphone denial is recoverable; transcript preserved
- [ ] Fast AI response does not interrupt the transition
- [ ] AI failure preserves transcript; retry and manual both work
- [ ] Regeneration preserves current version until accepted; undo works
- [ ] "Open the chapter" waits for scroll readiness with restrained copy
- [ ] Scroll advances and reverses; pausing freezes the frame
- [ ] Final save is idempotent; no profile becomes public
- [ ] Import opens next; product opens without replaying the intro
- [ ] Existing account is not forced into Origin; switching artists is safe
- [ ] Another user cannot read or edit Origin by UUID
- [ ] Reduced motion completes fully with no autoplay
- [ ] Root Lightfield remains exactly one WebGL context
