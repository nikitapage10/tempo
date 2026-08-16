import type {
  OnboardingMemberRole,
  StarterChecklistId,
} from "@/lib/api/member-onboarding";

export type StarterChecklistIcon =
  | "profile"
  | "track"
  | "audio"
  | "board"
  | "stats"
  | "spotify"
  | "roster"
  | "task"
  | "calendar"
  | "projects"
  | "notifications";

export type StarterChecklistStep = {
  id: StarterChecklistId;
  label: string;
  detail: string;
  href: string;
  icon: StarterChecklistIcon;
};

export type StarterChecklistContent = {
  eyebrow: string;
  heading: string;
  personalization: string | null;
  steps: StarterChecklistStep[];
};

const ARTIST_STEPS: StarterChecklistStep[] = [
  { id: "review_profile", label: "Review your artist profile", detail: "Make sure the story and identity feel like you.", href: "/artist", icon: "profile" },
  { id: "add_track", label: "Add your first track", detail: "Start with something you’re actively making.", href: "/board?new=1", icon: "track" },
  { id: "upload_tune", label: "Upload a tune", detail: "Put a first bounce inside a track workspace.", href: "/tracks", icon: "audio" },
  { id: "shape_board", label: "Shape your board", detail: "Review the stages that match your process.", href: "/board", icon: "board" },
  { id: "review_stats", label: "Review your stats", detail: "See what TEMPO can read from your work.", href: "/stats", icon: "stats" },
  { id: "connect_spotify", label: "Connect Spotify", detail: "Add your artist link to bring your catalog into view.", href: "/stats#platforms", icon: "spotify" },
];

type ProLens = {
  matches: RegExp;
  heading: string;
  task: Pick<StarterChecklistStep, "label" | "detail">;
  date: Pick<StarterChecklistStep, "label" | "detail">;
  view: Pick<StarterChecklistStep, "label" | "detail" | "href">;
};

const PRO_LENSES: ProLens[] = [
  {
    matches: /\bcollective\b/i,
    heading: "Set up the work around your collective.",
    task: { label: "Create a collective priority", detail: "Put the next shared follow-up somewhere everyone can move from." },
    date: { label: "Add the next shared date", detail: "Hold the deadline, gathering, or release moment that matters next." },
    view: { label: "Open your collective projects", detail: "Give campaigns, releases, and ongoing work a clear home.", href: "/projects" },
  },
  {
    matches: /\b(label|a\s*&\s*r)\b/i,
    heading: "Set up your release operation.",
    task: { label: "Create a release follow-up", detail: "Capture the next approval, delivery, or artist follow-up." },
    date: { label: "Add the next release checkpoint", detail: "Hold the delivery, announcement, or release date in one place." },
    view: { label: "Open your release projects", detail: "Give each campaign and release a working home.", href: "/projects" },
  },
  {
    matches: /\b(publicist|publicity|pr|marketing|digital)\b/i,
    heading: "Set up your campaign workspace.",
    task: { label: "Create a campaign follow-up", detail: "Start with the next pitch, approval, asset, or coverage follow-up." },
    date: { label: "Add the next campaign date", detail: "Hold an announcement, embargo, premiere, or delivery date." },
    view: { label: "Open your campaign projects", detail: "Keep each active campaign and its moving pieces together.", href: "/projects" },
  },
  {
    matches: /\b(tour|booking|agent|live)\b/i,
    heading: "Set up the road ahead.",
    task: { label: "Create an advance or booking follow-up", detail: "Capture the next hold, confirmation, venue, or travel action." },
    date: { label: "Add the next show or hold", detail: "Put the live date you need to protect on your calendar." },
    view: { label: "Open your live-work projects", detail: "Give a run, tour, or booking cycle one working home.", href: "/projects" },
  },
  {
    matches: /\b(creative|visual|design|designer|photo|video|director)\b/i,
    heading: "Set up your creative pipeline.",
    task: { label: "Create an asset handoff task", detail: "Start with the next brief, revision, approval, or delivery." },
    date: { label: "Add the next delivery date", detail: "Hold the deadline the creative work is moving toward." },
    view: { label: "Open your creative projects", detail: "Keep each campaign, shoot, or visual package together.", href: "/projects" },
  },
  {
    matches: /\b(engineer|producer|production|mix|master)\b/i,
    heading: "Set up your review flow.",
    task: { label: "Create a review follow-up", detail: "Capture the next files, notes, revision, or approval you need." },
    date: { label: "Add the next review date", detail: "Put the session, delivery, or listening deadline on your calendar." },
    view: { label: "Open your production projects", detail: "Give each active production or delivery a clear home.", href: "/projects" },
  },
  {
    matches: /\bpublisher|publishing\b/i,
    heading: "Set up your catalog follow-ups.",
    task: { label: "Create a catalog follow-up", detail: "Start with the next split, registration, pitch, or approval." },
    date: { label: "Add the next catalog deadline", detail: "Hold the registration, pitch, or delivery date that comes next." },
    view: { label: "Open your catalog projects", detail: "Keep active works and opportunities organized by project.", href: "/projects" },
  },
  {
    matches: /\bmanager|management\b/i,
    heading: "Set up the work around your roster.",
    task: { label: "Create a weekly priorities task", detail: "Start with the next move for the people and work you support." },
    date: { label: "Add the next key deadline", detail: "Hold the release, meeting, delivery, or decision date that matters next." },
    view: { label: "Open your roster projects", detail: "Give releases, campaigns, and ongoing work a clear home.", href: "/projects" },
  },
  {
    matches: /\bassistant|coordinator|operations\b/i,
    heading: "Set up your coordination home.",
    task: { label: "Create your first follow-up", detail: "Capture the next approval, handoff, or loose end to close." },
    date: { label: "Add the next important date", detail: "Put the deadline or meeting you need to protect on your calendar." },
    view: { label: "Open your working projects", detail: "Keep the people, dates, and follow-ups around each effort together.", href: "/projects" },
  },
];

const GENERAL_PRO_LENS: Omit<ProLens, "matches"> = {
  heading: "Set up your professional home.",
  task: { label: "Create your first follow-up", detail: "Capture one real next move from the work you support." },
  date: { label: "Add a date you need to hold", detail: "Put the next deadline, meeting, or delivery on your calendar." },
  view: { label: "Open your first project", detail: "Give a campaign, release, or ongoing effort a clear home.", href: "/projects" },
};

function cleanRoles(roles: string[]) {
  return Array.from(new Set(roles.map((role) => role.trim()).filter(Boolean)));
}

export function proChecklistLens(roles: string[]) {
  const cleaned = cleanRoles(roles);
  for (const role of cleaned) {
    const lens = PRO_LENSES.find((candidate) => candidate.matches.test(role));
    if (lens) return lens;
  }
  return GENERAL_PRO_LENS;
}

export function starterChecklistContent(
  memberRole: OnboardingMemberRole,
  passageRoles: string[] = []
): StarterChecklistContent {
  if (memberRole !== "team_member") {
    return {
      eyebrow: "Your first moves",
      heading: "Bring the workspace to life.",
      personalization: null,
      steps: ARTIST_STEPS,
    };
  }

  const roles = cleanRoles(passageRoles);
  const lens = proChecklistLens(roles);
  const roleSummary = roles.slice(0, 2).join(" + ");

  return {
    eyebrow: "Your professional setup",
    heading: lens.heading,
    personalization: roleSummary ? `Built around ${roleSummary} from Passage.` : null,
    steps: [
      { id: "pro_review_profile", label: "Review your professional profile", detail: "Make sure your name, roles, and identity represent you—not an artist.", href: "/profile", icon: "profile" },
      { id: "pro_review_roster", label: "Review artists you work with", detail: "See your active relationships and enter an artist workspace when needed.", href: "/team", icon: "roster" },
      { id: "pro_first_followup", ...lens.task, href: "/tasks", icon: "task" },
      { id: "pro_key_date", ...lens.date, href: "/calendar", icon: "calendar" },
      { id: "pro_work_view", ...lens.view, icon: "projects" },
      { id: "pro_notifications", label: "Choose what deserves a notification", detail: "Set the signal level that works for your role and workload.", href: "/settings?tab=notifications", icon: "notifications" },
    ],
  };
}
