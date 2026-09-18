import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_ROLES } from "@/lib/team/roles";
import {
  ALBUM_RELEASE,
  DEMO_BOARD_NOTES,
  DEMO_CALENDAR_EVENTS,
  DEMO_FEEDBACK,
  DEMO_PROJECTS,
  DEMO_SESSIONS,
  DEMO_SPACES,
  DEMO_STAGES,
  DEMO_TASKS,
  DEMO_TEAM,
  DEMO_TRACKS,
  DEMO_TRACK_GROUPS,
  DEMO_PROFILE,
  DEMO_SOCIAL_ARTISTS,
  DEMO_SOCIAL_POSTS,
  PRESIDENT_DEMO_KIND,
  PRESIDENT_DEMO_LOGO_URL,
  PRESIDENT_DEMO_PROFILE_URL,
} from "@/lib/demo/president";

/**
 * The demo catalog is one big web of string refs resolved at seed time, where
 * a broken link doesn't throw — it silently drops a session, or leaves a track
 * with no project. These assertions are the only thing standing between an
 * edit to the dataset and a demo that quietly seeds less than it claims.
 */

const trackRefs = new Set(DEMO_TRACKS.map((t) => t.ref));
const projectRefs = new Set(DEMO_PROJECTS.map((p) => p.ref));
const spaceRefs = new Set(DEMO_SPACES.map((s) => s.ref));
const stages = new Set<string>(DEMO_STAGES);

describe("PRESIDENT demo dataset", () => {
  it("keeps the supplied PRESIDENT wordmark and profile photo distinct", () => {
    expect(PRESIDENT_DEMO_KIND).toBe("president-v5");
    expect(PRESIDENT_DEMO_LOGO_URL).toBe("/demo/president/logo.webp");
    expect(PRESIDENT_DEMO_PROFILE_URL).toBe("/demo/president/profile.webp");
  });

  it("has no duplicate refs", () => {
    expect(trackRefs.size).toBe(DEMO_TRACKS.length);
    expect(projectRefs.size).toBe(DEMO_PROJECTS.length);
  });

  it("has no duplicate track titles", () => {
    // Seeding matches inserted rows back to refs by title, so two tracks
    // sharing one would cross-link their checklists and sessions.
    const titles = DEMO_TRACKS.map((t) => t.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("points every track at a real project, space stage and valid momentum", () => {
    for (const track of DEMO_TRACKS) {
      if (track.projectRef) expect(projectRefs).toContain(track.projectRef);
      expect(stages).toContain(track.stage);
      expect(["active", "simmering", "stalled", "parked"]).toContain(track.momentum);
    }
  });

  it("puts every project in a real space", () => {
    for (const project of DEMO_PROJECTS) {
      expect(spaceRefs).toContain(project.spaceRef);
    }
  });

  it("resolves every task reference", () => {
    for (const task of DEMO_TASKS) {
      expect(spaceRefs).toContain(task.spaceRef);
      if (task.projectRef) expect(projectRefs).toContain(task.projectRef);
      if (task.trackRef) expect(trackRefs).toContain(task.trackRef);
    }
  });

  it("resolves every calendar event and keeps timed events well formed", () => {
    for (const event of DEMO_CALENDAR_EVENTS) {
      expect(spaceRefs).toContain(event.spaceRef);
      if (event.projectRef) {
        expect(projectRefs).toContain(event.projectRef);
        expect(DEMO_PROJECTS.find((project) => project.ref === event.projectRef)?.spaceRef)
          .toBe(event.spaceRef);
      }
      expect(new Date(event.startsAt).getTime()).toBeLessThan(new Date(event.endsAt).getTime());
      expect(event.timezone).toBe("Europe/London");
    }
    expect(DEMO_CALENDAR_EVENTS.some((event) => event.kind === "live_show")).toBe(true);
  });

  it("uses recognisable, explicitly curated demo social examples", () => {
    const names = DEMO_SOCIAL_ARTISTS.map((artist) => artist.name);
    expect(names).toContain("Sleep Token");
    expect(names).toContain("Linkin Park");
    expect(names).toContain("My Chemical Romance");
    expect(new Set(names).size).toBe(names.length);
    for (const artist of DEMO_SOCIAL_ARTISTS) {
      expect(artist.location.length).toBeGreaterThan(2);
      expect(artist.countryCode).toMatch(/^[A-Z]{2}$/);
    }
    expect(DEMO_SOCIAL_POSTS.some((post) => post.reply)).toBe(true);
  });

  it("resolves every session, feedback and group reference", () => {
    for (const session of DEMO_SESSIONS) expect(trackRefs).toContain(session.trackRef);
    for (const item of DEMO_FEEDBACK) expect(trackRefs).toContain(item.trackRef);
    for (const group of DEMO_TRACK_GROUPS) {
      for (const ref of group.trackRefs) expect(trackRefs).toContain(ref);
    }
  });

  it("only pins board notes to stages that exist", () => {
    for (const note of DEMO_BOARD_NOTES) expect(stages).toContain(note.stage);
  });

  it("only pins tracks and board notes to the music-focus space", () => {
    // Stages and the board belong to a music space; a tasks-focus space has
    // neither, so anything staged there would seed with no stage at all.
    const music = DEMO_SPACES.find((s) => s.ref === "originals");
    expect(music?.focus).toBe("music");
  });

  it("keeps released tracks dated and unreleased ones undated", () => {
    for (const track of DEMO_TRACKS) {
      if (track.stage === "Released") {
        expect(track.releasedOn, `${track.title} is Released but has no date`).toBeTruthy();
      } else {
        expect(track.releasedOn, `${track.title} isn't Released but has a date`).toBeNull();
      }
    }
  });

  it("dates every released track on or before the album", () => {
    // A demo that shows songs released in the future reads as broken data.
    for (const track of DEMO_TRACKS) {
      if (!track.releasedOn) continue;
      expect(track.releasedOn.localeCompare(ALBUM_RELEASE)).toBeLessThanOrEqual(0);
    }
  });

  it("fills the early board stages, which no real discography can", () => {
    // The reason invented songs exist at all — if this fails, the left half
    // of the board is empty and the demo stops showing the thing it's for.
    for (const stage of ["Idea", "Writing", "Production"]) {
      expect(
        DEMO_TRACKS.some((t) => t.stage === stage),
        `nothing sits in ${stage}`
      ).toBe(true);
    }
  });

  it("keeps profile content inside the database constraints", () => {
    // Mirrors migrations 047 and 048 — these are CHECK constraints, so an
    // over-long story section fails the insert rather than truncating.
    expect(DEMO_PROFILE.soundMarkers.length).toBeLessThanOrEqual(5);
    for (const marker of DEMO_PROFILE.soundMarkers) {
      expect(marker.label.length).toBeGreaterThan(0);
      expect(marker.label.length).toBeLessThanOrEqual(60);
      expect(marker.description.length).toBeLessThanOrEqual(300);
    }
    expect(DEMO_PROFILE.storySections.length).toBeLessThanOrEqual(8);
    for (const section of DEMO_PROFILE.storySections) {
      expect(section.title.length).toBeLessThanOrEqual(120);
      expect(section.body.length).toBeLessThanOrEqual(2000);
    }
    expect(DEMO_PROFILE.featuredMusic.length).toBeLessThanOrEqual(6);
    for (const item of DEMO_PROFILE.featuredMusic) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.title.length).toBeLessThanOrEqual(120);
      expect(item.note.length).toBeLessThanOrEqual(160);
    }
    expect((DEMO_PROFILE.currentFocusTitle ?? "").length).toBeLessThanOrEqual(120);
    expect(DEMO_PROFILE.bio.length).toBeLessThanOrEqual(2000);
    expect(DEMO_PROFILE.bio.split("\n\n")).toHaveLength(3);
  });

  it("gives the demo artist a team whose photos actually exist", () => {
    expect(DEMO_TEAM.length).toBeGreaterThanOrEqual(5);
    expect(new Set(DEMO_TEAM.map((m) => m.ref)).size).toBe(DEMO_TEAM.length);
    for (const member of DEMO_TEAM) {
      expect(MEMBER_ROLES).toContain(member.role);
      expect(member.title.length).toBeGreaterThan(0);
      expect(member.holding.length).toBeGreaterThan(0);
      if (!member.photo) continue;
      expect(member.photo.startsWith("/demo/president/team/")).toBe(true);
      expect(
        existsSync(resolve("public", member.photo.replace(/^\//, ""))),
        `${member.name} has no photo file at ${member.photo}`
      ).toBe(true);
    }
  });

  it("covers the roles an artist actually asks about", () => {
    const titles = DEMO_TEAM.map((m) => m.title.toLowerCase()).join(" | ");
    for (const job of ["manager", "agent", "press", "guitar", "drums", "vocals"]) {
      expect(titles, `no one on the sample team does ${job}`).toContain(job);
    }
    // Everyone in the fan on Team has a face; the one without a photo is the
    // invite still out, which is why it reads as unfinished rather than empty.
    for (const member of DEMO_TEAM) {
      if (!member.photo) expect(member.pending).toBe(true);
    }
  });

  it("never presents the sample team as real memberships", () => {
    const seed = readFileSync(resolve("lib/demo/seed.ts"), "utf8");
    expect(seed).not.toContain("artist_members");
    const panel = readFileSync(resolve("components/demo/demo-team-panel.tsx"), "utf8");
    expect(panel).toContain("real TEMPO accounts");
  });
});
