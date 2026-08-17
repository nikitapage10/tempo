import type { ProWorkflowSeed } from "@/lib/pro-workflows/types";

const seeds: Record<string, ProWorkflowSeed> = {
  management: {
    key: "management",
    name: "Artist priorities",
    description: "Keep decisions, commitments, and artist-wide initiatives moving.",
    stages: [
      ["Incoming", "New asks and possibilities"],
      ["Shaping", "Clarify the outcome and owner"],
      ["In motion", "Active work across the team"],
      ["Waiting", "A decision or response is due"],
      ["Closed", "Finished or deliberately passed"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — next-quarter artist priorities", notes: "Turn the artist's goals into a few owned initiatives." },
  },
  anr: {
    key: "anr",
    name: "A&R listening",
    description: "Move submissions and prospects from first listen to a clear decision.",
    stages: [
      ["Submitted", "New music to hear"],
      ["First listen", "Initial notes and signal"],
      ["Team discussion", "Worth a wider conversation"],
      ["Follow-up", "Questions, meetings, or more music"],
      ["Decision", "Advance, hold, or pass"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — review this week's priority demos", notes: "One card can hold the listening notes, conversation, and final call." },
  },
  releases: {
    key: "releases",
    name: "Release pipeline",
    description: "See a release move from plan through delivery and campaign.",
    stages: [
      ["Planning", "Direction, date, and owners"],
      ["Assets", "Music, artwork, copy, and metadata"],
      ["Delivery", "Distribution and partner handoffs"],
      ["Campaign", "Audience work is live"],
      ["Released", "Live, learning, and follow-through"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — upcoming single campaign", notes: "Keep its tasks in Tasks; use this card to see the whole release move." },
  },
  booking: {
    key: "booking",
    name: "Booking pipeline",
    description: "Track opportunities from inquiry through the confirmed handoff.",
    stages: [
      ["Inquiry", "New dates and possibilities"],
      ["Hold", "Availability and terms in play"],
      ["Negotiating", "Deal points are moving"],
      ["Confirmed", "Agreement and deposit secured"],
      ["Handed off", "Ready for advancing"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — fall support opportunity", notes: "Collect the offer, routing context, and decision here." },
  },
  publicity: {
    key: "publicity",
    name: "Press campaign",
    description: "Move a story from angle and targets through coverage.",
    stages: [
      ["Story", "Shape the truthful campaign angle"],
      ["Targets", "Build and prioritize outreach"],
      ["Pitching", "Outreach is underway"],
      ["Follow-up", "Replies and requests need action"],
      ["Coverage", "Live wins and amplification"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — next release press story", notes: "Use tasks for individual sends; use this card for the campaign arc." },
  },
  touring: {
    key: "touring",
    name: "Show advancing",
    description: "Move confirmed shows from handoff through settlement.",
    stages: [
      ["Booked", "Confirmed and ready to receive"],
      ["Advancing", "Production and hospitality details"],
      ["Ready", "Day sheet and final checks complete"],
      ["Show day", "The live operating window"],
      ["Settled", "Money, files, and follow-up closed"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — next confirmed show", notes: "One place for the overall advance; detailed actions stay in Tasks." },
  },
  creative: {
    key: "creative",
    name: "Creative approvals",
    description: "Guide briefs and deliverables through feedback to final approval.",
    stages: [
      ["Brief", "Outcome and references"],
      ["Creating", "Work is being developed"],
      ["Review", "Feedback is being collected"],
      ["Revisions", "The agreed changes"],
      ["Approved", "Final files delivered"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — campaign artwork system", notes: "Track the deliverable here and the individual revision tasks in Tasks." },
  },
  marketing: {
    key: "marketing",
    name: "Campaign rollout",
    description: "Move campaign ideas through production, scheduling, and learning.",
    stages: [
      ["Ideas", "Angles worth considering"],
      ["Planned", "Brief, audience, and channel set"],
      ["Producing", "Assets and copy in progress"],
      ["Scheduled", "Approved and queued"],
      ["Live + learning", "Results and next moves"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — four-week audience campaign", notes: "Use this for the campaign's state, not every post task." },
  },
  publishing: {
    key: "publishing",
    name: "Song opportunities",
    description: "Track songs and opportunities from intake to outcome.",
    stages: [
      ["Incoming", "Songs, briefs, and requests"],
      ["Matching", "Find the right fit"],
      ["Submitted", "Sent and awaiting signal"],
      ["In conversation", "Terms or creative follow-up"],
      ["Outcome", "Placed, held, or passed"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — current sync brief", notes: "Keep candidate songs and the submission outcome together." },
  },
  production: {
    key: "production",
    name: "Client production",
    description: "Move a production engagement from brief through delivery.",
    stages: [
      ["Inquiry", "New project or session request"],
      ["Scoped", "Terms, direction, and timing"],
      ["In session", "Recording or production underway"],
      ["Revisions", "Feedback and final changes"],
      ["Delivered", "Files and closeout complete"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — new production engagement", notes: "The card holds the client arc; Tasks holds the session actions." },
  },
  operations: {
    key: "operations",
    name: "Operations desk",
    description: "Turn incoming requests into clear, completed handoffs.",
    stages: [
      ["Inbox", "Loose requests and notes"],
      ["Clarifying", "Owner, deadline, and outcome"],
      ["Coordinating", "People and pieces are moving"],
      ["Waiting", "A response or approval is due"],
      ["Handed off", "Closed with context intact"],
    ].map(([name, description]) => ({ name, description })),
    example: { title: "Example — organize next week's priorities", notes: "A flexible starting point for mixed or assistant work." },
  },
};

const roleKeys: Array<[RegExp, string]> = [
  [/tour/i, "touring"],
  [/a\s*&\s*r/i, "anr"],
  [/label|collective/i, "releases"],
  [/booking|agent/i, "booking"],
  [/publicist|\bpr\b/i, "publicity"],
  [/manager/i, "management"],
  [/creative|visual|designer|photo|video/i, "creative"],
  [/marketing|digital/i, "marketing"],
  [/publisher/i, "publishing"],
  [/engineer|producer/i, "production"],
  [/assistant/i, "operations"],
];

export function workflowSeedsForRoles(roles: string[]): ProWorkflowSeed[] {
  const keys: string[] = [];
  for (const role of roles) {
    const key = roleKeys.find(([pattern]) => pattern.test(role))?.[1];
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) keys.push("operations");
  return keys.slice(0, 3).map((key) => seeds[key]);
}

export const ALL_PRO_WORKFLOW_SEEDS = Object.values(seeds);
