/**
 * The PRESIDENT sample catalog.
 *
 * Pure data — no I/O, no Supabase, safe to import from either side of the
 * client/server line. `lib/demo/seed.ts` turns it into rows.
 *
 * PRESIDENT are a real, anonymous masked English rock band who appeared on the
 * Download festival poster in February 2025 and have been widely reported as
 * fronted by Charlie Simpson. Titles, track numbers, running times, release
 * dates and label are taken from their published discography so the demo shows
 * TEMPO holding a real campaign rather than lorem ipsum.
 *
 * Where TEMPO stores something the public record does not contain — BPM,
 * musical key, session notes, guest feedback, next moves — the value is
 * invented so the feature has something to display. That is why every surface
 * that shows this artist is labelled as sample data, and why it lives on its
 * own artist that can be removed in one action.
 *
 * Six songs are invented outright, marked in place further down. A released
 * discography has nothing in Idea, Writing or Production by definition, so
 * without them the left half of the board would always be empty — which is
 * the half a new artist most needs to see working. They sit under a project
 * named "Record two (working)" and are never presented as real releases.
 *
 * Dates are anchored to ALBUM_RELEASE rather than "today", so the campaign
 * reads the same whenever someone opens the demo.
 */

export const PRESIDENT_DEMO_KIND = "president";

export const PRESIDENT_SPOTIFY_ARTIST_ID = "40nPYop0FOD9Syyu5y4dAU";
export const PRESIDENT_SPOTIFY_URL = `https://open.spotify.com/artist/${PRESIDENT_SPOTIFY_ARTIST_ID}`;

/** Blood Of Your Empire, Atlantic Records. The spine of the demo timeline. */
export const ALBUM_RELEASE = "2026-09-04";

export type DemoStage =
  | "Idea"
  | "Writing"
  | "Production"
  | "Mixdown"
  | "Master"
  | "Release Prep"
  | "Released";

export type DemoTrack = {
  ref: string;
  title: string;
  projectRef: string | null;
  stage: DemoStage;
  momentum: "active" | "simmering" | "stalled" | "parked";
  /** Real, from the published track listing. */
  trackNumber: number | null;
  durationSec: number | null;
  /** Real: the date this actually came out, or null if still unreleased. */
  releasedOn: string | null;
  /** Invented — the public record has no BPM or key for these. */
  bpm: number | null;
  musicalKey: string | null;
  genre: string;
  tags: string[];
  notes: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  blockedReason?: string | null;
  waitingOn?: string | null;
  deadline?: string | null;
  checklist?: { text: string; done: boolean }[];
};

export type DemoProject = {
  ref: string;
  name: string;
  projectType: "album" | "ep" | "single" | "general";
  description: string;
  deadline: string | null;
  spaceRef: "originals" | "campaign";
};

export const DEMO_PROJECTS: DemoProject[] = [
  {
    ref: "boye",
    name: "Blood Of Your Empire",
    projectType: "album",
    description:
      "The debut full-length. Ten tracks, out 4 September 2026 on Atlantic. Written out of an existential crisis — belief, mortality, and our relationship with faith.",
    deadline: ALBUM_RELEASE,
    spaceRef: "originals",
  },
  {
    ref: "kot",
    name: "King Of Terrors",
    projectType: "ep",
    description:
      "The debut EP, out 26 September 2025. Darkness, religion and death — the record that introduced the masks.",
    deadline: "2025-09-26",
    spaceRef: "originals",
  },
  {
    // Invented, like the songs under it — see the note above the second half
    // of DEMO_TRACKS. No follow-up record has been announced.
    ref: "two",
    name: "Record two (working)",
    projectType: "general",
    description:
      "Where the next record is being sketched while the first one ships. Nothing here is finished and nothing is promised to anyone.",
    deadline: null,
    spaceRef: "originals",
  },
  {
    ref: "launch",
    name: "Blood Of Your Empire — launch",
    projectType: "general",
    description:
      "Everything around the record that isn't the record: announce, press, visuals, retail, and the run of shows into release week.",
    deadline: ALBUM_RELEASE,
    spaceRef: "campaign",
  },
];

/**
 * Album order is the real track listing. Stage reflects where each song would
 * sit four weeks out from release: singles are long gone, the rest are
 * finishing.
 */
export const DEMO_TRACKS: DemoTrack[] = [
  {
    ref: "angel-wings",
    title: "Angel Wings",
    projectRef: "boye",
    stage: "Released",
    momentum: "simmering",
    trackNumber: 1,
    durationSec: 232,
    releasedOn: "2026-02-18",
    bpm: 146,
    musicalKey: "F# minor",
    genre: "Alternative metal",
    tags: ["single", "album"],
    notes:
      "First single off the album. Charted #17 on Hot Hard Rock Songs and clipped the UK sales chart at #99.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "doom-loop",
    title: "DOOM LOOP",
    projectRef: "boye",
    stage: "Released",
    momentum: "active",
    trackNumber: 2,
    durationSec: 240,
    releasedOn: "2026-05-21",
    bpm: 132,
    musicalKey: "E minor",
    genre: "Alternative metal",
    tags: ["single", "album", "announce"],
    notes:
      "The song that announced the album. About the strange tragedy of time — chasing it, wasting it, fearing it, then realising what a moment was worth once it's gone. Peaked at #8 on Hot Hard Rock Songs.",
    nextAction: "Approve the live visual edit for the release-week shows",
    nextActionDue: "2026-08-21",
  },
  {
    ref: "dark-heaven",
    title: "dark heaven",
    projectRef: "boye",
    stage: "Released",
    momentum: "active",
    trackNumber: 3,
    durationSec: 212,
    releasedOn: "2026-07-30",
    bpm: 128,
    musicalKey: "C# minor",
    genre: "Alternative metal",
    tags: ["single", "album"],
    notes: "Fourth single, out with a visualiser two weeks before the record.",
    nextAction: "Send the visualiser stems to the lighting designer",
    nextActionDue: "2026-08-14",
  },
  {
    ref: "pink-noise",
    title: "Pink Noise",
    projectRef: "boye",
    stage: "Master",
    momentum: "active",
    trackNumber: 4,
    durationSec: 244,
    releasedOn: null,
    bpm: 150,
    musicalKey: "G minor",
    genre: "Alternative metal",
    tags: ["album", "mastering"],
    notes: "Second mastering pass — the first was too loud through the chorus.",
    nextAction: "Review the revised master against the reference",
    nextActionDue: "2026-08-13",
    waitingOn: "Mastering engineer",
    deadline: "2026-08-15",
    checklist: [
      { text: "Mix locked", done: true },
      { text: "Master pass 1", done: true },
      { text: "Master pass 2 revisions", done: false },
      { text: "Approve for delivery", done: false },
    ],
  },
  {
    ref: "mercy",
    title: "Mercy",
    projectRef: "boye",
    stage: "Released",
    momentum: "simmering",
    trackNumber: 5,
    durationSec: 229,
    releasedOn: "2026-03-26",
    bpm: 138,
    musicalKey: "A minor",
    genre: "Alternative metal",
    tags: ["single", "album"],
    notes: "Second single.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "sleepwalker",
    title: "Sleepwalker",
    projectRef: "boye",
    stage: "Release Prep",
    momentum: "active",
    trackNumber: 6,
    durationSec: 228,
    releasedOn: null,
    bpm: 124,
    musicalKey: "D minor",
    genre: "Alternative metal",
    tags: ["album"],
    notes: "Quietest thing on the record. Master signed off; artwork variant still open.",
    nextAction: "Pick between the two alternate sleeve crops",
    nextActionDue: "2026-08-17",
    deadline: ALBUM_RELEASE,
    checklist: [
      { text: "Final master approved", done: true },
      { text: "ISRC assigned", done: true },
      { text: "Delivered to distributor", done: false },
    ],
  },
  {
    // Already out: Dionysus appeared on the King Of Terrors EP a year before
    // the album, and carries over as album track 7.
    ref: "dionysus",
    title: "Dionysus",
    projectRef: "boye",
    stage: "Released",
    momentum: "simmering",
    trackNumber: 7,
    durationSec: 182,
    releasedOn: "2025-09-26",
    bpm: 160,
    musicalKey: "B minor",
    genre: "Alternative metal",
    tags: ["album", "ep"],
    notes:
      "Shortest thing they've released. Came out on King Of Terrors first and carries over onto the album.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "this-will-divide-us",
    title: "This Will Divide Us",
    projectRef: "boye",
    stage: "Master",
    momentum: "active",
    trackNumber: 8,
    durationSec: 243,
    releasedOn: null,
    bpm: 142,
    musicalKey: "F minor",
    genre: "Alternative metal",
    tags: ["album", "mastering"],
    notes: "Out at mastering with Pink Noise. Same session, same reference.",
    nextAction: "Approve the master",
    nextActionDue: "2026-08-15",
    waitingOn: "Mastering engineer",
    deadline: "2026-08-15",
    checklist: [
      { text: "Mix locked", done: true },
      { text: "Master pass 1", done: false },
      { text: "Approve for delivery", done: false },
    ],
  },
  {
    ref: "hate-figure",
    title: "Hate Figure (feat. Ando San)",
    projectRef: "boye",
    stage: "Mixdown",
    momentum: "stalled",
    trackNumber: 9,
    durationSec: 168,
    releasedOn: null,
    bpm: 155,
    musicalKey: "E minor",
    genre: "Alternative metal",
    tags: ["album", "feature", "mix"],
    notes:
      "The only feature on the record. Vocal is in; the mix can't be locked until the split sheet comes back signed.",
    nextAction: "Chase the signed split sheet",
    nextActionDue: "2026-08-12",
    blockedReason: "Split sheet unsigned — can't deliver the mix without it",
    waitingOn: "Ando San's management",
    deadline: "2026-08-19",
    checklist: [
      { text: "Feature vocal recorded", done: true },
      { text: "Rough mix approved", done: true },
      { text: "Split sheet signed", done: false },
      { text: "Final mix locked", done: false },
    ],
  },
  {
    ref: "white-devil",
    title: "White Devil",
    projectRef: "boye",
    stage: "Release Prep",
    momentum: "active",
    trackNumber: 10,
    durationSec: 263,
    releasedOn: null,
    bpm: 118,
    musicalKey: "C minor",
    genre: "Alternative metal",
    tags: ["album", "closer"],
    notes: "Closes the record. Longest track, and the one the live set is being built around.",
    nextAction: "Lock the live arrangement for the tour rehearsal",
    nextActionDue: "2026-08-24",
    deadline: ALBUM_RELEASE,
    checklist: [
      { text: "Final master approved", done: true },
      { text: "Delivered to distributor", done: false },
      { text: "Live arrangement locked", done: false },
    ],
  },

  // King Of Terrors, 26 September 2025, and the singles that led into it.
  // Titles and dates below were read back off PRESIDENT's live Spotify
  // catalog rather than guessed, so the EP's own track order isn't asserted —
  // only that these songs are on it.
  {
    ref: "in-the-name",
    title: "In the Name of the Father",
    projectRef: "kot",
    stage: "Released",
    momentum: "parked",
    trackNumber: null,
    durationSec: null,
    releasedOn: "2025-05-15",
    bpm: 140,
    musicalKey: "D minor",
    genre: "Alternative metal",
    tags: ["ep", "single"],
    notes: "The first thing PRESIDENT ever put out.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "fearless",
    title: "Fearless",
    projectRef: "kot",
    stage: "Released",
    momentum: "simmering",
    trackNumber: null,
    durationSec: null,
    releasedOn: "2025-06-05",
    bpm: 152,
    musicalKey: "G# minor",
    genre: "Alternative metal",
    tags: ["ep", "single", "catalog-driver"],
    notes: "Still the most-streamed song in the catalog by a distance.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "rage",
    title: "RAGE",
    projectRef: "kot",
    stage: "Released",
    momentum: "simmering",
    trackNumber: null,
    durationSec: null,
    releasedOn: "2025-07-17",
    bpm: 134,
    musicalKey: "A minor",
    genre: "Alternative metal",
    tags: ["ep", "single", "synth"],
    notes:
      "The synth-heavy one. Written off the back of Dylan Thomas — do not go gentle into that good night.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "destroy-me",
    title: "Destroy Me",
    projectRef: null,
    stage: "Released",
    momentum: "parked",
    trackNumber: null,
    durationSec: null,
    releasedOn: "2025-09-04",
    bpm: 144,
    musicalKey: "F minor",
    genre: "Alternative metal",
    tags: ["single"],
    notes: "Standalone single, three weeks ahead of the EP. Not on either record.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "conclave",
    title: "Conclave",
    projectRef: "kot",
    stage: "Released",
    momentum: "parked",
    trackNumber: null,
    durationSec: null,
    releasedOn: "2025-09-26",
    bpm: 126,
    musicalKey: "C# minor",
    genre: "Alternative metal",
    tags: ["ep"],
    notes: "EP track — arrived with the record rather than ahead of it.",
    nextAction: null,
    nextActionDue: null,
  },

  // ---------------------------------------------------------------------
  // INVENTED. Everything below this line is written for the demo — these are
  // not PRESIDENT songs and no such record has been announced.
  //
  // They exist because the real catalog can't fill the early half of the
  // board: a released discography has nothing sitting in Idea, Writing or
  // Production by definition. Titles stay inside the band's register —
  // scripture, mortality, empire — so the board reads as one body of work,
  // and they're grouped under a plainly-marked working project rather than
  // mixed into the real album.
  // ---------------------------------------------------------------------
  {
    ref: "gethsemane",
    title: "Gethsemane",
    projectRef: "two",
    stage: "Idea",
    momentum: "simmering",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: null,
    musicalKey: null,
    genre: "Alternative metal",
    tags: ["record-two", "idea"],
    notes: "Voice memo from the back of the bus. One line and a chord, but it keeps coming back.",
    nextAction: "Get the voice memo into a session",
    nextActionDue: "2026-09-18",
  },
  {
    ref: "second-death",
    title: "The Second Death",
    projectRef: "two",
    stage: "Idea",
    momentum: "parked",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: null,
    musicalKey: null,
    genre: "Alternative metal",
    tags: ["record-two", "idea"],
    notes: "Title first, song second. Might end up being the thing the whole record hangs off.",
    nextAction: null,
    nextActionDue: null,
  },
  {
    ref: "no-kingdom",
    title: "No Kingdom Comes",
    projectRef: "two",
    stage: "Writing",
    momentum: "active",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: 92,
    musicalKey: "D minor",
    genre: "Alternative metal",
    tags: ["record-two"],
    notes: "Slowest thing written so far. Verse works, chorus doesn't arrive yet.",
    nextAction: "Write a chorus that earns the verse",
    nextActionDue: "2026-09-25",
    checklist: [
      { text: "Verse melody", done: true },
      { text: "Lyric draft", done: true },
      { text: "Chorus", done: false },
      { text: "Demo it properly", done: false },
    ],
  },
  {
    ref: "hollow-crown",
    title: "Hollow Crown",
    projectRef: "two",
    stage: "Writing",
    momentum: "stalled",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: 168,
    musicalKey: "B minor",
    genre: "Alternative metal",
    tags: ["record-two", "fast"],
    notes: "Fastest thing on the board. Been stuck on the second verse for three weeks.",
    nextAction: "Finish the second verse or cut it",
    nextActionDue: "2026-09-11",
    blockedReason: "Second verse isn't working and rewriting it hasn't helped",
  },
  {
    ref: "vespers",
    title: "Vespers",
    projectRef: "two",
    stage: "Production",
    momentum: "active",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: 108,
    musicalKey: "F# minor",
    genre: "Alternative metal",
    tags: ["record-two", "choir"],
    notes: "The one the real choir is for. Programmed voices are standing in and it already works.",
    nextAction: "Price up a day with an actual choir",
    nextActionDue: "2026-10-02",
    checklist: [
      { text: "Arrangement locked", done: true },
      { text: "Guide vocal", done: true },
      { text: "Choir stand-in programmed", done: true },
      { text: "Book the real choir", done: false },
      { text: "Guitars", done: false },
    ],
  },
  {
    ref: "every-empire",
    title: "Every Empire Falls",
    projectRef: "two",
    stage: "Production",
    momentum: "active",
    trackNumber: null,
    durationSec: null,
    releasedOn: null,
    bpm: 136,
    musicalKey: "E minor",
    genre: "Alternative metal",
    tags: ["record-two"],
    notes: "Answers the first record directly. Drums and bass down, guitars next.",
    nextAction: "Track guitars",
    nextActionDue: "2026-09-30",
    checklist: [
      { text: "Drums", done: true },
      { text: "Bass", done: true },
      { text: "Guitars", done: false },
      { text: "Lead vocal", done: false },
    ],
  },
];

export type DemoTask = {
  title: string;
  category: "social" | "outreach" | "pitching" | "admin" | "production" | "other";
  status: "todo" | "doing" | "done";
  /** Days relative to the album release. Negative = before it. */
  dueOffsetDays: number | null;
  spaceRef: "originals" | "campaign";
  projectRef: string | null;
  trackRef: string | null;
  notes: string | null;
};

export const DEMO_TASKS: DemoTask[] = [
  {
    title: "Chase the signed split sheet for Hate Figure",
    category: "admin",
    status: "doing",
    dueOffsetDays: -23,
    spaceRef: "originals",
    projectRef: "boye",
    trackRef: "hate-figure",
    notes: "Blocking the final mix. Management has had it a week.",
  },
  {
    title: "Approve the revised Pink Noise master",
    category: "production",
    status: "todo",
    dueOffsetDays: -22,
    spaceRef: "originals",
    projectRef: "boye",
    trackRef: "pink-noise",
    notes: "A/B against the reference before signing off.",
  },
  {
    title: "Deliver the remaining six masters to the distributor",
    category: "admin",
    status: "todo",
    dueOffsetDays: -14,
    spaceRef: "originals",
    projectRef: "boye",
    trackRef: null,
    notes: "Everything except the four released singles.",
  },
  {
    title: "File all ten sets of lyrics with the publisher",
    category: "admin",
    status: "todo",
    dueOffsetDays: -10,
    spaceRef: "originals",
    projectRef: "boye",
    trackRef: null,
    notes: null,
  },
  {
    title: "Lock the release-week set list",
    category: "production",
    status: "doing",
    dueOffsetDays: -11,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: "Built around White Devil as the closer.",
  },
  {
    title: "Sign off the vinyl test pressing",
    category: "admin",
    status: "done",
    dueOffsetDays: -40,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: null,
  },
  {
    title: "Announce release-week shows",
    category: "social",
    status: "done",
    dueOffsetDays: -35,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: null,
  },
  {
    title: "Confirm the album press embargo date",
    category: "outreach",
    status: "todo",
    dueOffsetDays: -18,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: "Reviews go live the Monday of release week.",
  },
  {
    title: "Pitch the record to editorial playlists",
    category: "pitching",
    status: "todo",
    dueOffsetDays: -28,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: "Four weeks ahead is the cutoff — don't miss it.",
  },
  {
    title: "Shoot the mask reveal teaser",
    category: "social",
    status: "todo",
    dueOffsetDays: -7,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: "Keep it ambiguous. The point is that nobody finds out.",
  },
  {
    title: "Book the in-store signing",
    category: "outreach",
    status: "todo",
    dueOffsetDays: 3,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: null,
  },
  {
    title: "Send thank-you notes to the mixing and mastering teams",
    category: "other",
    status: "todo",
    dueOffsetDays: 7,
    spaceRef: "campaign",
    projectRef: "launch",
    trackRef: null,
    notes: null,
  },
];

/**
 * Backdated focus sessions so Stats, the weekly focus line on Today, and the
 * Calendar timeline have a real history instead of zeroes. Offsets are days
 * before "now" at seed time — recent enough that this week's numbers are alive.
 */
export const DEMO_SESSIONS: {
  trackRef: string;
  daysAgo: number;
  startHour: number;
  minutes: number;
  goal: string;
  note: string;
  outcome: string;
}[] = [
  {
    trackRef: "pink-noise",
    daysAgo: 0,
    startHour: 10,
    minutes: 95,
    goal: "Compare master pass 2 against the reference",
    note: "Chorus is breathing again. Still a touch bright at the top.",
    outcome: "Sent notes back to mastering",
  },
  {
    trackRef: "hate-figure",
    daysAgo: 1,
    startHour: 14,
    minutes: 70,
    goal: "Tidy the feature vocal edit",
    note: "Comped the last verse properly. Can't do more until the paperwork lands.",
    outcome: "Vocal edit done, mix still blocked",
  },
  {
    trackRef: "white-devil",
    daysAgo: 2,
    startHour: 19,
    minutes: 140,
    goal: "Build the live arrangement",
    note: "Stripped the intro right back so the room fills before the first hit.",
    outcome: "Live version roughed out",
  },
  {
    trackRef: "sleepwalker",
    daysAgo: 4,
    startHour: 11,
    minutes: 55,
    goal: "Check the master on three systems",
    note: "Holds up in the car. Approved.",
    outcome: "Master approved",
  },
  {
    trackRef: "this-will-divide-us",
    daysAgo: 5,
    startHour: 13,
    minutes: 110,
    goal: "Lock the mix",
    note: "Pulled the second guitar down 1.5dB and it finally sat right.",
    outcome: "Mix locked, sent to mastering",
  },
  {
    trackRef: "pink-noise",
    daysAgo: 8,
    startHour: 15,
    minutes: 80,
    goal: "Review master pass 1",
    note: "Too loud through the chorus — the snare disappears. Asked for another pass.",
    outcome: "Sent back for revisions",
  },
  {
    trackRef: "dark-heaven",
    daysAgo: 11,
    startHour: 9,
    minutes: 65,
    goal: "Pull stems for the visualiser",
    note: "Bounced eight stems for the lighting designer.",
    outcome: "Stems delivered",
  },
  {
    trackRef: "white-devil",
    daysAgo: 13,
    startHour: 20,
    minutes: 125,
    goal: "Rewrite the outro",
    note: "Held the last chord four bars longer. It earns it now.",
    outcome: "Outro rewritten",
  },
  {
    trackRef: "doom-loop",
    daysAgo: 17,
    startHour: 16,
    minutes: 45,
    goal: "Cut the live visual edit",
    note: "First pass is too fast. Needs to sit with the tempo.",
    outcome: "Rough edit, needs another pass",
  },
  {
    trackRef: "vespers",
    daysAgo: 3,
    startHour: 21,
    minutes: 165,
    goal: "Program the choir stand-in",
    note: "Six stacked takes through a plate. It's obviously not real voices, and it still works.",
    outcome: "Arrangement holds — worth the real choir",
  },
  {
    trackRef: "every-empire",
    daysAgo: 6,
    startHour: 12,
    minutes: 100,
    goal: "Track bass",
    note: "One pass, kept the first take. Guitars next week.",
    outcome: "Bass down",
  },
  {
    trackRef: "hollow-crown",
    daysAgo: 10,
    startHour: 17,
    minutes: 50,
    goal: "Crack the second verse",
    note: "Fourth attempt. Still nothing. Leaving it alone for a while.",
    outcome: "No progress — parked it",
  },
];

/**
 * Guest feedback rows, as if bounces had been shared through review links.
 * Deliberately attached to tracks rather than versions: the demo ships no
 * audio, so there is no version to hang a timestamped comment off.
 */
export const DEMO_FEEDBACK: {
  trackRef: string;
  reviewer: string;
  text: string;
  status: "open" | "resolved" | "wont_fix";
  daysAgo: number;
}[] = [
  {
    trackRef: "pink-noise",
    reviewer: "Mastering engineer",
    text: "Second pass attached. I've backed off the limiter through the chorus — you were losing the snare. Shout if it's now too soft against White Devil.",
    status: "open",
    daysAgo: 1,
  },
  {
    trackRef: "hate-figure",
    reviewer: "Ando San",
    text: "Vocal sounds great. One ask — can we keep the ad-lib at 2:14? It got buried in the last version you sent.",
    status: "open",
    daysAgo: 3,
  },
  {
    trackRef: "white-devil",
    reviewer: "A&R (Atlantic)",
    text: "This is the closer, no question. Don't shorten it for radio — let it run.",
    status: "resolved",
    daysAgo: 6,
  },
  {
    trackRef: "sleepwalker",
    reviewer: "Tour manager",
    text: "If this goes in the set it needs a click — the tempo drifts live.",
    status: "open",
    daysAgo: 9,
  },
  {
    trackRef: "this-will-divide-us",
    reviewer: "Mix engineer",
    text: "Guitar balance sorted as discussed. I'd leave the vocal where it is — pushing it further breaks the wall.",
    status: "resolved",
    daysAgo: 12,
  },
  {
    trackRef: "vespers",
    reviewer: "A&R (Atlantic)",
    text: "Heard the rough. If the choir is real on this one it's a single — don't let it become a programmed thing.",
    status: "open",
    daysAgo: 4,
  },
  {
    trackRef: "no-kingdom",
    reviewer: "Mix engineer",
    text: "The verse is the best thing you've written. Whatever the chorus turns out to be, don't let it get louder than that.",
    status: "open",
    daysAgo: 8,
  },
];

/** Sticky notes on the board — where the next record is being sketched. */
export const DEMO_BOARD_NOTES: { stage: DemoStage; title: string; body: string }[] = [
  {
    stage: "Idea",
    title: "Record two — the question",
    body: "First record asked whether any of it means anything. The second one has to answer, or admit it can't.",
  },
  {
    stage: "Idea",
    title: "Choir, properly",
    body: "Not a sample. An actual room of people. Budget it before the tour eats everything.",
  },
  {
    stage: "Writing",
    title: "Keep the masks off the writing",
    body: "The anonymity is for the stage. Don't let it get into the songs — that's how it turns into a gimmick.",
  },
];

/** The Tracks page groups — album and EP, so grouping isn't empty. */
export const DEMO_TRACK_GROUPS: { name: string; trackRefs: string[] }[] = [
  {
    name: "Blood Of Your Empire",
    trackRefs: [
      "angel-wings",
      "doom-loop",
      "dark-heaven",
      "pink-noise",
      "mercy",
      "sleepwalker",
      "dionysus",
      "this-will-divide-us",
      "hate-figure",
      "white-devil",
    ],
  },
  { name: "King Of Terrors", trackRefs: ["in-the-name", "fearless", "rage", "conclave"] },
  {
    name: "Record two (working)",
    trackRefs: [
      "gethsemane",
      "second-death",
      "no-kingdom",
      "hollow-crown",
      "vespers",
      "every-empire",
    ],
  },
];

/**
 * The Artist page. Everything here is drawn from what PRESIDENT have actually
 * said in public — the album's stated themes, the Doom Loop quote, the Download
 * appearance — rather than a personality invented for the demo.
 */
export const DEMO_PROFILE = {
  displayName: "PRESIDENT",
  handle: "president",
  paletteId: "noir",
  tagline: "C I T I Z E N S",
  location: "London, United Kingdom",
  countryCode: "GB",
  pronouns: null as string | null,
  genres: ["Alternative metal", "Hard rock", "Post-hardcore"],
  roles: ["Artist", "Producer"],
  bio:
    "An anonymous masked English rock band. PRESIDENT appeared without warning on the Download festival poster in February 2025, played five songs at the festival that June, and released the King Of Terrors EP that September. The debut album Blood Of Your Empire follows on 4 September 2026 through Atlantic Records. Nobody in the band has confirmed who they are, and that is the point — the record is meant to arrive without a face attached to it.",
  currentFocusTitle: "Four weeks from the debut album",
  currentFocusBody:
    "Blood Of Your Empire is out 4 September. Six of the ten tracks are still moving through mastering and delivery, the split sheet on the feature is holding up a mix, and the live set for release week is being built around the closer.",
  soundMarkers: [
    {
      label: "Weight without volume",
      description:
        "The heaviest moments are usually the quietest ones. Space is used as an instrument, so the impacts land instead of blurring.",
    },
    {
      label: "Synths against guitars",
      description:
        "RAGE went fully synth-led and it stuck. Electronics sit alongside the guitars rather than decorating them.",
    },
    {
      label: "Scripture as a lever",
      description:
        "Religious language is used for its force, not its doctrine — King Of Terrors is a biblical phrase for death.",
    },
    {
      label: "Anonymity as sound design",
      description:
        "No face, no backstory, no interviews in character. What's left is the record, which is the only thing meant to be listened to.",
    },
    {
      label: "Time running out",
      description:
        "Doom Loop is about chasing, wasting and fearing time, then realising what a moment was worth once it's gone. That anxiety runs through the whole album.",
    },
  ],
  storySections: [
    {
      title: "A name on a poster",
      body: "In February 2025 the name PRESIDENT appeared on the Download festival poster with no music, no photographs and no explanation attached to it. The first song, In The Name Of The Father, followed in May. Five songs were played at Download that June, in masks, to a crowd that had mostly never heard them.",
    },
    {
      title: "King Of Terrors",
      body: "The debut EP arrived on 26 September 2025. The title is a biblical name for death, and the record works through darkness, religion and mortality without settling any of it. RAGE — the synth-heavy one — was written off the back of Dylan Thomas: do not go gentle into that good night. Fearless is still the most-played song in the catalog.",
    },
    {
      title: "Blood Of Your Empire",
      body: "The debut album was born, in the band's own words, out of a struggle with existential crisis and trying to make sense of belief, mortality and humanity's relationship with faith. Ten tracks, self-produced, out 4 September 2026 on Atlantic Records. Angel Wings, Mercy, Doom Loop and dark heaven came first; the rest of the record has stayed unheard until release.",
    },
    {
      title: "The masks stay on",
      body: "There has been no reveal and there isn't one planned. The speculation is constant and the band has never engaged with it. Everything the audience is given is the music, the artwork, and what happens on stage.",
    },
  ],
  featuredMusic: [
    {
      title: "DOOM LOOP",
      url: "https://open.spotify.com/artist/40nPYop0FOD9Syyu5y4dAU",
      note: "The song that announced the album",
    },
    {
      title: "Fearless",
      url: "https://open.spotify.com/artist/40nPYop0FOD9Syyu5y4dAU",
      note: "The one most people found us through",
    },
    {
      title: "RAGE",
      url: "https://open.spotify.com/artist/40nPYop0FOD9Syyu5y4dAU",
      note: "Do not go gentle",
    },
  ],
  links: [
    { label: "Spotify", url: PRESIDENT_SPOTIFY_URL },
  ],
} as const;

/** The two spaces the demo artist gets, and what each is for. */
export const DEMO_SPACES: {
  ref: "originals" | "campaign";
  name: string;
  focus: "music" | "tasks";
}[] = [
  { ref: "originals", name: "Originals", focus: "music" },
  { ref: "campaign", name: "Campaign", focus: "tasks" },
];

export const DEMO_STAGES: DemoStage[] = [
  "Idea",
  "Writing",
  "Production",
  "Mixdown",
  "Master",
  "Release Prep",
  "Released",
];
