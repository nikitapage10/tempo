import type { ArtistOverview } from "@/lib/artist-stats";
import type { Attribute, AttributeKey, PointEvent } from "./attributes";
import type { AchievementGrade } from "./grades";

/**
 * The full achievement catalog — every definition, in code, reviewable in a
 * diff. Awards (which artist has earned which key, when) live in the
 * database (migrations/088_artist_achievements.sql); this file is only the
 * rulebook.
 *
 * Tone target: dry and specific, never congratulatory-generic. No emoji, no
 * exclamation points, nothing shames inaction. Roughly a third are graded
 * Umbra — hidden, unnamed in the list — until they fire.
 */

export type AchievementContext = {
  now: Date;
  overview: ArtistOverview;
  attributesByKey: Record<AttributeKey, Attribute>;
  pointEvents: PointEvent[];
  finishedCount: number;
  bounceCount: number;
  masterCount: number;
  stageAdvanceCount: number;
  sessionCompletedCount: number;
  performanceCount: number;
  festivalCount: number;
  firstPerformanceAt: string | null;
  /** Raw performance rows — needed for checks that read role/context directly rather than through the point ledger. */
  performances: { role: string; context: string; performedOn: string }[];
  maxFollowers: number;
  hasAnyPlatform: boolean;
  originCompleted: boolean;
  onboardingChecklistCompleted: boolean;
  fastestForwardDwellHours: number | null;
};

export type AchievementDef = {
  key: string;
  name: string;
  flavor: string;
  grade: AchievementGrade;
  attribute: AttributeKey | null;
  points: number;
  check: (ctx: AchievementContext) => boolean;
};

function keysUsed(ctx: AchievementContext): number {
  return ctx.overview.keys.length;
}
function genresUsed(ctx: AchievementContext): number {
  return ctx.overview.genres.length;
}
function bpmSpan(ctx: AchievementContext): number {
  const bpms = ctx.overview.bpm.filter((b) => b.count > 0);
  if (bpms.length < 2) return 0;
  return bpms[bpms.length - 1].end - bpms[0].start;
}
function longestLingerDays(ctx: AchievementContext): number {
  return ctx.overview.lingering.reduce((max, t) => Math.max(max, t.daysOpen), 0);
}
function feedbackTotal(ctx: AchievementContext): number {
  return ctx.overview.guestComments + ctx.overview.ownComments;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------------------------------------------------------------------
  // Output & finishing (~20)
  // ---------------------------------------------------------------------
  {
    key: "output_first_bounce",
    name: "First Draft",
    flavor: "Uploaded a bounce. The idea now exists outside your head.",
    grade: "glimmer",
    attribute: "output",
    points: 4,
    check: (c) => c.bounceCount >= 1,
  },
  {
    key: "output_five_bounces",
    name: "Working Copy",
    flavor: "Five bounces in. You're iterating, not just starting.",
    grade: "glimmer",
    attribute: "output",
    points: 4,
    check: (c) => c.bounceCount >= 5,
  },
  {
    key: "output_twenty_bounces",
    name: "Studio Rat",
    flavor: "Twenty bounces. The upload button knows your name.",
    grade: "refraction",
    attribute: "output",
    points: 4,
    check: (c) => c.bounceCount >= 20,
  },
  {
    key: "output_hundred_bounces",
    name: "Bounce Economy",
    flavor: "A hundred bounces uploaded, all told.",
    grade: "flare",
    attribute: "output",
    points: 4,
    check: (c) => c.bounceCount >= 100,
  },
  {
    key: "output_first_finished",
    name: "Ship of Theseus",
    flavor: "First track to reach a final stage. Every part changed, the name stayed.",
    grade: "glimmer",
    attribute: "output",
    points: 15,
    check: (c) => c.finishedCount >= 1,
  },
  {
    key: "output_five_finished",
    name: "Repeat Offender",
    flavor: "Five tracks finished. The first one wasn't a fluke.",
    grade: "refraction",
    attribute: "output",
    points: 15,
    check: (c) => c.finishedCount >= 5,
  },
  {
    key: "output_ten_finished",
    name: "Double Digits",
    flavor: "Ten finished tracks. That's an album and change.",
    grade: "refraction",
    attribute: "output",
    points: 15,
    check: (c) => c.finishedCount >= 10,
  },
  {
    key: "output_twentyfive_finished",
    name: "Discography",
    flavor: "Twenty-five finished tracks. Someone could write a Wikipedia stub about you now.",
    grade: "flare",
    attribute: "output",
    points: 15,
    check: (c) => c.finishedCount >= 25,
  },
  {
    key: "output_fifty_finished",
    name: "Prolific",
    flavor: "Fifty finished tracks. This stopped being a hobby a while ago.",
    grade: "corona",
    attribute: "output",
    points: 15,
    check: (c) => c.finishedCount >= 50,
  },
  {
    key: "output_first_master",
    name: "Print It",
    flavor: "First track marked as a master. It's done being worked on.",
    grade: "refraction",
    attribute: "output",
    points: 20,
    check: (c) => c.masterCount >= 1,
  },
  {
    key: "output_ten_masters",
    name: "Mastering Engineer's Best Friend",
    flavor: "Ten masters logged.",
    grade: "flare",
    attribute: "output",
    points: 20,
    check: (c) => c.masterCount >= 10,
  },
  {
    key: "output_first_release",
    name: "Out In The World",
    flavor: "A track carries a real release date now, not a target one.",
    grade: "refraction",
    attribute: "output",
    points: 15,
    check: (c) => c.overview.releasedCount >= 1,
  },
  {
    key: "output_five_releases",
    name: "Back Catalog",
    flavor: "Five releases out. People can binge you now.",
    grade: "flare",
    attribute: "output",
    points: 15,
    check: (c) => c.overview.releasedCount >= 5,
  },
  {
    key: "output_finish_under_week",
    name: "Fast Turnaround",
    flavor: "A track went from opened to finished in under a week.",
    grade: "refraction",
    attribute: "output",
    points: 10,
    check: (c) => c.fastestForwardDwellHours !== null && c.fastestForwardDwellHours <= 24,
  },
  {
    key: "output_year_of_bounces",
    name: "Twelve Months Running",
    flavor: "Every one of the last twelve months has at least one bounce in it.",
    grade: "flare",
    attribute: "output",
    points: 10,
    check: (c) => c.overview.monthly.every((m) => m.bounces > 0),
  },
  {
    key: "output_busy_month",
    name: "Heavy Month",
    flavor: "Ten or more bounces landed in a single month.",
    grade: "refraction",
    attribute: "output",
    points: 8,
    check: (c) => c.overview.monthly.some((m) => m.bounces >= 10),
  },
  {
    key: "output_five_started_one_month",
    name: "Idea Dump",
    flavor: "Five new tracks started in the same month.",
    grade: "glimmer",
    attribute: "output",
    points: 6,
    check: (c) => c.overview.monthly.some((m) => m.started >= 5),
  },
  {
    key: "output_ep_release",
    name: "Extended Play",
    flavor: "Three or more releases share a release date.",
    grade: "refraction",
    attribute: "output",
    points: 10,
    check: (c) => {
      const byDate = new Map<string, number>();
      for (const r of c.overview.releases) {
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);
      }
      return Array.from(byDate.values()).some((n) => n >= 3);
    },
  },
  {
    key: "output_two_hundred_bounces",
    name: "The Vault",
    flavor: "Two hundred bounces uploaded. Somewhere in there is a b-side worth revisiting.",
    grade: "corona",
    attribute: "output",
    points: 4,
    check: (c) => c.bounceCount >= 200,
  },
  {
    key: "output_umbra_first_week",
    name: "Week One",
    flavor: "Finished a track in your first week using TEMPO.",
    grade: "umbra",
    attribute: "output",
    points: 12,
    check: (c) => {
      if (c.finishedCount < 1 || !c.overview.firstActivityAt) return false;
      const started = new Date(c.overview.firstActivityAt).getTime();
      const events = c.pointEvents.filter((e) => e.ruleKey === "track_finished");
      return events.some(
        (e) => new Date(e.occurredAt).getTime() - started <= 7 * 86_400_000
      );
    },
  },

  // ---------------------------------------------------------------------
  // Workflow & velocity (~15)
  // ---------------------------------------------------------------------
  {
    key: "velocity_first_move",
    name: "Next",
    flavor: "First forward stage move logged.",
    grade: "glimmer",
    attribute: "velocity",
    points: 6,
    check: (c) => c.stageAdvanceCount >= 1,
  },
  {
    key: "velocity_ten_moves",
    name: "Assembly Line",
    flavor: "Ten forward stage moves.",
    grade: "glimmer",
    attribute: "velocity",
    points: 6,
    check: (c) => c.stageAdvanceCount >= 10,
  },
  {
    key: "velocity_fifty_moves",
    name: "Pipeline Operator",
    flavor: "Fifty forward stage moves logged.",
    grade: "refraction",
    attribute: "velocity",
    points: 6,
    check: (c) => c.stageAdvanceCount >= 50,
  },
  {
    key: "velocity_hundred_moves",
    name: "Well-Oiled",
    flavor: "A hundred forward stage moves. The board barely has time to breathe.",
    grade: "flare",
    attribute: "velocity",
    points: 6,
    check: (c) => c.stageAdvanceCount >= 100,
  },
  {
    key: "velocity_same_day",
    name: "Same-Day Service",
    flavor: "A track moved forward within a day of entering its previous stage.",
    grade: "refraction",
    attribute: "velocity",
    points: 10,
    check: (c) => c.fastestForwardDwellHours !== null && c.fastestForwardDwellHours <= 24,
  },
  {
    key: "velocity_clear_old_stall",
    name: "Unstuck",
    flavor: "Moved a track forward after it sat 90+ days in one stage.",
    grade: "flare",
    attribute: "velocity",
    points: 12,
    check: (c) => c.overview.lingering.some((t) => t.daysInStage >= 90),
  },
  {
    key: "velocity_clear_old_stall_180",
    name: "Excavation",
    flavor: "Moved a track forward after half a year in one stage.",
    grade: "corona",
    attribute: "velocity",
    points: 15,
    check: (c) => c.overview.lingering.some((t) => t.daysInStage >= 180),
  },
  {
    key: "velocity_rating_strong",
    name: "In Motion",
    flavor: "Velocity reads Strong or better.",
    grade: "refraction",
    attribute: "velocity",
    points: 10,
    check: (c) =>
      (c.attributesByKey.velocity.rating ?? 0) >= 65 &&
      c.attributesByKey.velocity.confidence === "measured",
  },
  {
    key: "velocity_rating_peak",
    name: "Full Throttle",
    flavor: "Velocity reads Peak.",
    grade: "flare",
    attribute: "velocity",
    points: 12,
    check: (c) =>
      (c.attributesByKey.velocity.rating ?? 0) >= 85 &&
      c.attributesByKey.velocity.confidence === "measured",
  },
  {
    key: "workflow_five_spaces",
    name: "Multi-Room Studio",
    flavor: "Five or more spaces under one artist.",
    grade: "refraction",
    attribute: null,
    points: 8,
    check: (c) => c.overview.spaces.length >= 5,
  },
  {
    key: "workflow_ten_stages_cleared",
    name: "Assembly Complete",
    flavor: "Ten distinct tracks have all cleared at least one stage boundary.",
    grade: "refraction",
    attribute: null,
    points: 8,
    check: (c) => {
      const tracks = new Set(
        c.pointEvents
          .filter((e) => e.ruleKey === "stage_advanced")
          .map((e) => e.subjectId)
      );
      return tracks.size >= 10;
    },
  },
  {
    key: "workflow_all_momentum_active",
    name: "Everything's Moving",
    flavor: "Not one track in the catalog is stalled or parked right now.",
    grade: "flare",
    attribute: null,
    points: 10,
    check: (c) =>
      c.overview.momentum.every(
        (m) => (m.value !== "stalled" && m.value !== "parked") || m.count === 0
      ) && c.overview.trackCount > 0,
  },
  {
    key: "workflow_no_lingering",
    name: "Nothing Left Behind",
    flavor: "No unfinished track has sat longer than 30 days in its current stage.",
    grade: "refraction",
    attribute: null,
    points: 8,
    check: (c) =>
      c.overview.lingering.length > 0 &&
      c.overview.lingering.every((t) => t.daysInStage < 30),
  },
  {
    key: "workflow_umbra_double_advance",
    name: "Two In One",
    flavor: "Moved two different tracks forward on the same calendar day.",
    grade: "umbra",
    attribute: "velocity",
    points: 6,
    check: (c) => {
      const byDay = new Map<string, Set<string>>();
      for (const e of c.pointEvents) {
        if (e.ruleKey !== "stage_advanced" || !e.subjectId) continue;
        const day = e.occurredAt.slice(0, 10);
        const set = byDay.get(day) ?? new Set<string>();
        set.add(e.subjectId);
        byDay.set(day, set);
      }
      return Array.from(byDay.values()).some((s) => s.size >= 2);
    },
  },
  {
    key: "workflow_umbra_year_no_stall_penalty",
    name: "Clean Sheet",
    flavor: "A full year with no stall penalty logged against you.",
    grade: "umbra",
    attribute: "follow_through",
    points: 10,
    check: (c) => {
      const oneYearAgo = c.now.getTime() - 365 * 86_400_000;
      const penalties = c.pointEvents.filter(
        (e) =>
          e.ruleKey === "track_stalled" &&
          new Date(e.occurredAt).getTime() >= oneYearAgo
      );
      return c.overview.firstActivityAt !== null &&
        new Date(c.overview.firstActivityAt).getTime() <= oneYearAgo &&
        penalties.length === 0;
    },
  },

  // ---------------------------------------------------------------------
  // Consistency & rhythm (~15)
  // ---------------------------------------------------------------------
  {
    key: "consistency_first_session",
    name: "Clocked In",
    flavor: "First focus session logged.",
    grade: "glimmer",
    attribute: "consistency",
    points: 3,
    check: (c) => c.sessionCompletedCount >= 1,
  },
  {
    key: "consistency_ten_sessions",
    name: "Regular",
    flavor: "Ten focus sessions completed.",
    grade: "glimmer",
    attribute: "consistency",
    points: 3,
    check: (c) => c.sessionCompletedCount >= 10,
  },
  {
    key: "consistency_fifty_sessions",
    name: "Creature of Habit",
    flavor: "Fifty focus sessions completed.",
    grade: "refraction",
    attribute: "consistency",
    points: 3,
    check: (c) => c.sessionCompletedCount >= 50,
  },
  {
    key: "consistency_four_weeks",
    name: "A Month of Mondays",
    flavor: "Four weeks running with logged activity.",
    grade: "glimmer",
    attribute: "consistency",
    points: 6,
    check: (c) => c.overview.streakWeeks >= 4,
  },
  {
    key: "consistency_twelve_weeks",
    name: "Quarter Streak",
    flavor: "Twelve weeks running.",
    grade: "refraction",
    attribute: "consistency",
    points: 8,
    check: (c) => c.overview.streakWeeks >= 12,
  },
  {
    key: "consistency_twentysix_weeks",
    name: "Half a Year Running",
    flavor: "Twenty-six straight weeks of logged activity.",
    grade: "flare",
    attribute: "consistency",
    points: 10,
    check: (c) => c.overview.streakWeeks >= 26,
  },
  {
    key: "consistency_year_streak",
    name: "Anniversary",
    flavor: "Fifty-two straight weeks. TEMPO has seen an entire year of you.",
    grade: "corona",
    attribute: "consistency",
    points: 15,
    check: (c) => c.overview.streakWeeks >= 52,
  },
  {
    key: "rhythm_early_bird",
    name: "Early Bird",
    flavor: "Your busiest hour starts before 8am.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) =>
      !!c.overview.bestHourLabel && /^[0-7]:/.test(c.overview.bestHourLabel),
  },
  {
    key: "rhythm_night_owl",
    name: "Night Owl",
    flavor: "Your busiest hour is after 11pm.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) =>
      !!c.overview.bestHourLabel && /^(2[3])|^0:/.test(c.overview.bestHourLabel),
  },
  {
    key: "rhythm_weekend_warrior",
    name: "Weekend Warrior",
    flavor: "Your busiest day is Saturday or Sunday.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) =>
      c.overview.bestDayLabel === "Sat" || c.overview.bestDayLabel === "Sun",
  },
  {
    key: "rhythm_weekday_grinder",
    name: "Nine to Five, Then Some",
    flavor: "Your busiest day is a Tuesday, Wednesday, or Thursday.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) =>
      c.overview.bestDayLabel === "Tue" ||
      c.overview.bestDayLabel === "Wed" ||
      c.overview.bestDayLabel === "Thu",
  },
  {
    key: "rhythm_hundred_hours",
    name: "Triple Digits",
    flavor: "A hundred hours of logged focus time.",
    grade: "flare",
    attribute: "consistency",
    points: 10,
    check: (c) => c.overview.focusSec >= 100 * 3600,
  },
  {
    key: "rhythm_five_hundred_hours",
    name: "Five Hundred Club",
    flavor: "Five hundred hours logged in the room.",
    grade: "corona",
    attribute: "consistency",
    points: 15,
    check: (c) => c.overview.focusSec >= 500 * 3600,
  },
  {
    key: "consistency_rating_strong",
    name: "Dependable",
    flavor: "Consistency reads Strong or better.",
    grade: "refraction",
    attribute: "consistency",
    points: 8,
    check: (c) => (c.attributesByKey.consistency.rating ?? 0) >= 65,
  },
  {
    key: "consistency_umbra_leap_day",
    name: "Extra Day",
    flavor: "Logged a session on February 29th.",
    grade: "umbra",
    attribute: "consistency",
    points: 6,
    check: (c) =>
      c.pointEvents.some((e) => {
        const d = new Date(e.occurredAt);
        return d.getMonth() === 1 && d.getDate() === 29;
      }),
  },
  {
    key: "consistency_umbra_midnight",
    name: "Witching Hour",
    flavor: "Logged a session between midnight and 1am.",
    grade: "umbra",
    attribute: "consistency",
    points: 4,
    check: (c) =>
      c.pointEvents.some(
        (e) => e.ruleKey === "session_completed" && new Date(e.occurredAt).getHours() === 0
      ),
  },

  // ---------------------------------------------------------------------
  // Craft & catalog (~15)
  // ---------------------------------------------------------------------
  {
    key: "craft_three_keys",
    name: "Modulation",
    flavor: "Written in three or more different keys.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) => keysUsed(c) >= 3,
  },
  {
    key: "craft_five_keys",
    name: "Circle of Fifths",
    flavor: "Five or more keys across your catalog.",
    grade: "refraction",
    attribute: null,
    points: 6,
    check: (c) => keysUsed(c) >= 5,
  },
  {
    key: "craft_three_genres",
    name: "Crate Digger",
    flavor: "Three or more genres tagged across your catalog.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) => genresUsed(c) >= 3,
  },
  {
    key: "craft_five_genres",
    name: "Genre-Fluid",
    flavor: "Five or more genres. Nobody can pin you down.",
    grade: "refraction",
    attribute: null,
    points: 6,
    check: (c) => genresUsed(c) >= 5,
  },
  {
    key: "craft_wide_tempo_range",
    name: "Full Range",
    flavor: "A 100+ BPM spread across your catalog.",
    grade: "refraction",
    attribute: null,
    points: 6,
    check: (c) => bpmSpan(c) >= 100,
  },
  {
    key: "craft_sub_80_bpm",
    name: "Low End",
    flavor: "Something in your catalog sits under 80 BPM.",
    grade: "glimmer",
    attribute: null,
    points: 3,
    check: (c) => c.overview.bpm.some((b) => b.start < 80 && b.count > 0),
  },
  {
    key: "craft_over_170_bpm",
    name: "Redline",
    flavor: "Something in your catalog sits past 170 BPM.",
    grade: "glimmer",
    attribute: null,
    points: 3,
    check: (c) => c.overview.bpm.some((b) => b.start >= 170 && b.count > 0),
  },
  {
    key: "craft_three_types",
    name: "Original, Remix, Edit",
    flavor: "All three track types show up somewhere in your catalog.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) => c.overview.types.length >= 3,
  },
  {
    key: "craft_first_remix",
    name: "Reinterpreted",
    flavor: "First remix logged.",
    grade: "glimmer",
    attribute: null,
    points: 3,
    check: (c) => c.overview.types.some((t) => t.label === "Remix" && t.count > 0),
  },
  {
    key: "craft_fifty_tracks",
    name: "Sprawling Catalog",
    flavor: "Fifty tracks in the catalog, finished or not.",
    grade: "refraction",
    attribute: null,
    points: 6,
    check: (c) => c.overview.trackCount >= 50,
  },
  {
    key: "craft_hundred_tracks",
    name: "Vast Catalog",
    flavor: "A hundred tracks in the catalog.",
    grade: "flare",
    attribute: null,
    points: 8,
    check: (c) => c.overview.trackCount >= 100,
  },
  {
    key: "craft_output_rating_peak",
    name: "Peak Output",
    flavor: "Output reads Peak.",
    grade: "flare",
    attribute: "output",
    points: 12,
    check: (c) => (c.attributesByKey.output.rating ?? 0) >= 85,
  },
  {
    key: "craft_long_track",
    name: "Epic",
    flavor: "A single bounce runs eight minutes or longer.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) => c.overview.catalogSec > 0 && c.overview.catalogSec / Math.max(1, c.overview.bounceCount) >= 480,
  },
  {
    key: "craft_umbra_palindrome_bpm",
    name: "Palindrome",
    flavor: "Logged a track at a palindromic BPM (like 121 or 141).",
    grade: "umbra",
    attribute: null,
    points: 4,
    check: (c) =>
      c.overview.bpm.some((b) => {
        const n = Math.round(b.start);
        const s = String(n);
        return b.count > 0 && s.length >= 2 && s === s.split("").reverse().join("");
      }),
  },
  {
    key: "craft_umbra_same_key_streak",
    name: "One Key Wonder",
    flavor: "Your single most-used key covers more than half your catalog.",
    grade: "umbra",
    attribute: null,
    points: 5,
    check: (c) => {
      const top = c.overview.keys[0];
      return !!top && top.count > c.overview.trackCount / 2 && c.overview.trackCount >= 6;
    },
  },

  // ---------------------------------------------------------------------
  // Collaboration & feedback (~12)
  // ---------------------------------------------------------------------
  {
    key: "collab_first_feedback",
    name: "Second Opinion",
    flavor: "First piece of feedback received on a bounce.",
    grade: "glimmer",
    attribute: null,
    points: 3,
    check: (c) => feedbackTotal(c) >= 1,
  },
  {
    key: "collab_first_guest_feedback",
    name: "Outside Ears",
    flavor: "First comment from a guest review link.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) => c.overview.guestComments >= 1,
  },
  {
    key: "collab_ten_feedback",
    name: "Notes Session",
    flavor: "Ten pieces of feedback received.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) => feedbackTotal(c) >= 10,
  },
  {
    key: "collab_fifty_feedback",
    name: "Well-Reviewed",
    flavor: "Fifty pieces of feedback received across your catalog.",
    grade: "flare",
    attribute: null,
    points: 8,
    check: (c) => feedbackTotal(c) >= 50,
  },
  {
    key: "collab_resolve_ten",
    name: "Cleared the Inbox",
    flavor: "Ten feedback threads resolved.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) => feedbackTotal(c) - c.overview.openThreads >= 10,
  },
  {
    key: "collab_resolve_twentyfive",
    name: "Nothing Left Open",
    flavor: "Twenty-five feedback threads resolved.",
    grade: "flare",
    attribute: null,
    points: 8,
    check: (c) => feedbackTotal(c) - c.overview.openThreads >= 25,
  },
  {
    key: "collab_first_decision",
    name: "Verdict",
    flavor: "First decision logged on a bounce.",
    grade: "glimmer",
    attribute: null,
    points: 3,
    check: (c) => c.overview.decisionCount >= 1,
  },
  {
    key: "collab_first_approval",
    name: "Signed Off",
    flavor: "First approval logged.",
    grade: "glimmer",
    attribute: null,
    points: 4,
    check: (c) => c.overview.approvalCount >= 1,
  },
  {
    key: "collab_ten_approvals",
    name: "Trusted Ears",
    flavor: "Ten approvals logged.",
    grade: "refraction",
    attribute: null,
    points: 6,
    check: (c) => c.overview.approvalCount >= 10,
  },
  {
    key: "collab_no_open_threads",
    name: "Fully Closed",
    flavor: "Every feedback thread you have is resolved.",
    grade: "refraction",
    attribute: null,
    points: 5,
    check: (c) => feedbackTotal(c) > 0 && c.overview.openThreads === 0,
  },
  {
    key: "collab_zero_open_at_scale",
    name: "Zero Backlog",
    flavor: "Twenty or more resolved threads and none left open.",
    grade: "flare",
    attribute: null,
    points: 8,
    check: (c) =>
      feedbackTotal(c) - c.overview.openThreads >= 20 && c.overview.openThreads === 0,
  },
  {
    key: "collab_umbra_own_notes_only",
    name: "Solo Session",
    flavor: "Ten or more of your own notes, and not a single guest comment yet.",
    grade: "umbra",
    attribute: null,
    points: 4,
    check: (c) => c.overview.ownComments >= 10 && c.overview.guestComments === 0,
  },

  // ---------------------------------------------------------------------
  // Live & reach (~12)
  // ---------------------------------------------------------------------
  {
    key: "live_first_show",
    name: "First Set",
    flavor: "First performance logged.",
    grade: "glimmer",
    attribute: "stage_presence",
    points: 10,
    check: (c) => c.performanceCount >= 1,
  },
  {
    key: "live_five_shows",
    name: "Road Tested",
    flavor: "Five performances logged.",
    grade: "refraction",
    attribute: "stage_presence",
    points: 10,
    check: (c) => c.performanceCount >= 5,
  },
  {
    key: "live_twenty_shows",
    name: "Circuit Regular",
    flavor: "Twenty performances logged.",
    grade: "flare",
    attribute: "stage_presence",
    points: 10,
    check: (c) => c.performanceCount >= 20,
  },
  {
    key: "live_fifty_shows",
    name: "Road Dog",
    flavor: "Fifty performances logged. You know which green rooms have decent coffee.",
    grade: "corona",
    attribute: "stage_presence",
    points: 12,
    check: (c) => c.performanceCount >= 50,
  },
  {
    key: "live_first_festival",
    name: "Main Stage Adjacent",
    flavor: "First festival slot logged.",
    grade: "refraction",
    attribute: "stage_presence",
    points: 6,
    check: (c) => c.festivalCount >= 1,
  },
  {
    key: "live_five_festivals",
    name: "Festival Season",
    flavor: "Five festival slots logged.",
    grade: "flare",
    attribute: "stage_presence",
    points: 8,
    check: (c) => c.festivalCount >= 5,
  },
  {
    key: "live_first_headline",
    name: "Top of the Bill",
    flavor: "First performance logged with headline billing.",
    grade: "flare",
    attribute: "stage_presence",
    points: 10,
    check: (c) => c.performances.some((p) => p.role === "headline"),
  },
  {
    key: "reach_first_link",
    name: "On the Record",
    flavor: "Linked a streaming platform for the first time.",
    grade: "glimmer",
    attribute: "reach",
    points: 4,
    check: (c) => c.hasAnyPlatform,
  },
  {
    key: "reach_hundred_followers",
    name: "First Hundred",
    flavor: "Crossed 100 combined followers across linked platforms.",
    grade: "glimmer",
    attribute: "reach",
    points: 6,
    check: (c) => c.maxFollowers >= 100,
  },
  {
    key: "reach_thousand_followers",
    name: "Four Figures",
    flavor: "Crossed 1,000 combined followers.",
    grade: "refraction",
    attribute: "reach",
    points: 10,
    check: (c) => c.maxFollowers >= 1000,
  },
  {
    key: "reach_ten_thousand_followers",
    name: "Five Figures",
    flavor: "Crossed 10,000 combined followers.",
    grade: "flare",
    attribute: "reach",
    points: 15,
    check: (c) => c.maxFollowers >= 10000,
  },
  {
    key: "live_umbra_same_week_two_shows",
    name: "Back to Back",
    flavor: "Two performances logged within seven days of each other.",
    grade: "umbra",
    attribute: "stage_presence",
    points: 6,
    check: (c) => {
      if (!c.firstPerformanceAt) return false;
      const events = c.pointEvents
        .filter((e) => e.ruleKey === "performance_logged")
        .map((e) => new Date(e.occurredAt).getTime())
        .sort((a, b) => a - b);
      for (let i = 1; i < events.length; i++) {
        if (events[i] - events[i - 1] <= 7 * 86_400_000) return true;
      }
      return false;
    },
  },

  // ---------------------------------------------------------------------
  // Housekeeping & Umbra (~11)
  // ---------------------------------------------------------------------
  {
    key: "house_origin_complete",
    name: "Told Your Story",
    flavor: "Finished setting up your artist Origin.",
    grade: "glimmer",
    attribute: null,
    points: 5,
    check: (c) => c.originCompleted,
  },
  {
    key: "house_checklist_complete",
    name: "Settled In",
    flavor: "Finished the getting-started checklist.",
    grade: "glimmer",
    attribute: null,
    points: 5,
    check: (c) => c.onboardingChecklistCompleted,
  },
  {
    key: "house_unpark_old",
    name: "Second Chance",
    flavor: "An active, unfinished track that's been open six months or more and isn't parked — you kept it moving instead of shelving it.",
    grade: "refraction",
    attribute: "follow_through",
    points: 10,
    check: (c) =>
      c.overview.lingering.some(
        (t) => t.track.momentum !== "parked" && t.daysOpen >= 180
      ),
  },
  {
    key: "house_weekend_finish",
    name: "Weekend Job",
    flavor: "Finished a track on a Saturday or Sunday.",
    grade: "glimmer",
    attribute: "output",
    points: 4,
    check: (c) =>
      c.pointEvents.some((e) => {
        if (e.ruleKey !== "track_finished") return false;
        const day = new Date(e.occurredAt).getDay();
        return day === 0 || day === 6;
      }),
  },
  {
    key: "house_three_stages_one_track",
    name: "The Whole Route",
    flavor: "One track cleared three or more stage boundaries over its life.",
    grade: "refraction",
    attribute: "velocity",
    points: 6,
    check: (c) => {
      const perTrack = new Map<string, number>();
      for (const e of c.pointEvents) {
        if (e.ruleKey !== "stage_advanced" || !e.subjectId) continue;
        perTrack.set(e.subjectId, (perTrack.get(e.subjectId) ?? 0) + 1);
      }
      return Array.from(perTrack.values()).some((n) => n >= 3);
    },
  },
  {
    key: "house_umbra_one_of_everything",
    name: "Full Set",
    flavor: "At least one track, one bounce, one master, one performance, and one platform link — all at once.",
    grade: "umbra",
    attribute: null,
    points: 10,
    check: (c) =>
      c.overview.trackCount >= 1 &&
      c.bounceCount >= 1 &&
      c.masterCount >= 1 &&
      c.performanceCount >= 1 &&
      c.hasAnyPlatform,
  },
  {
    key: "house_umbra_all_bands_measured",
    name: "Fully Lit",
    flavor: "Every attribute is measured at once — nothing dashed out.",
    grade: "umbra",
    attribute: null,
    points: 12,
    check: (c) =>
      Object.values(c.attributesByKey).every((a) => a.confidence === "measured"),
  },
  {
    key: "house_umbra_all_peak",
    name: "Spectral",
    flavor: "Every measured attribute reads Peak at the same time.",
    grade: "umbra",
    attribute: null,
    points: 25,
    check: (c) => {
      const measured = Object.values(c.attributesByKey).filter(
        (a) => a.confidence === "measured"
      );
      return measured.length >= 4 && measured.every((a) => (a.rating ?? 0) >= 85);
    },
  },
  {
    key: "house_umbra_comeback",
    name: "Comeback",
    flavor: "Logged real activity after ninety or more days of quiet.",
    grade: "umbra",
    attribute: "consistency",
    points: 8,
    check: (c) => {
      const sessions = c.pointEvents
        .filter((e) => e.ruleKey === "session_completed" || e.ruleKey === "bounce_uploaded")
        .map((e) => new Date(e.occurredAt).getTime())
        .sort((a, b) => a - b);
      for (let i = 1; i < sessions.length; i++) {
        if (sessions[i] - sessions[i - 1] >= 90 * 86_400_000) return true;
      }
      return false;
    },
  },
  {
    key: "house_umbra_anniversary",
    name: "One Year In",
    flavor: "A full year since your first logged activity in TEMPO.",
    grade: "umbra",
    attribute: null,
    points: 10,
    check: (c) =>
      !!c.overview.firstActivityAt &&
      c.now.getTime() - new Date(c.overview.firstActivityAt).getTime() >= 365 * 86_400_000,
  },
  {
    key: "house_umbra_everything_at_once",
    name: "The Whole Machine",
    flavor: "Points earned this week from output, velocity, consistency, and stage presence, all at once.",
    grade: "umbra",
    attribute: null,
    points: 15,
    check: (c) => {
      const weekAgo = c.now.getTime() - 7 * 86_400_000;
      const recent = c.pointEvents.filter(
        (e) => new Date(e.occurredAt).getTime() >= weekAgo
      );
      const attrs = new Set(recent.map((e) => e.attribute));
      return (
        attrs.has("output") &&
        attrs.has("velocity") &&
        attrs.has("consistency") &&
        attrs.has("stage_presence")
      );
    },
  },
];

export function achievementByKey(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
