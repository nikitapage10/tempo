import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AREA_KEYS, normalizeAreas } from "@/lib/team/areas";
import { ROLE_PRESETS } from "@/lib/team/roles";
import { renderTeamInviteEmail } from "@/lib/team/invite-email";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Team Operations 1.0", () => {
  it("uses the closed ten-area access vocabulary", () => {
    expect(AREA_KEYS).toEqual([
      "catalog", "audio", "feedback", "tasks", "calendar",
      "releases", "stats", "performances", "social", "team",
    ]);
    expect(normalizeAreas({ tasks: "write", unknown: "write", audio: "wrong" })).toEqual({ tasks: "write" });
  });

  it("ships explicit split-area role defaults and owner-only administration", () => {
    expect(ROLE_PRESETS.manager).toMatchObject({ catalog: "write", audio: "write", feedback: "write", tasks: "write" });
    expect(ROLE_PRESETS.tour_manager).toMatchObject({ audio: "read", feedback: "read", tasks: "read", calendar: "write" });
    for (const preset of Object.values(ROLE_PRESETS)) {
      expect(preset.team ?? "none").not.toBe("write");
      expect(preset.social ?? "none").not.toBe("write");
      expect(preset.stats ?? "none").not.toBe("write");
    }
  });

  it("delivers every additive Team Operations package", () => {
    const paths = [
      "migrations/101_team_permission_and_lifecycle.sql",
      "migrations/102_team_assignments_and_reviews.sql",
      "migrations/103_team_brief_and_room.sql",
      "migrations/104_pro_operations.sql",
      "migrations/105_pro_starter_kits.sql",
      "migrations/106_artist_team_requests.sql",
      "migrations/107_richer_pro_starter_kits.sql",
    ];
    for (const path of paths) {
      expect(existsSync(resolve(path)), path).toBe(true);
      const sql = read(path);
      expect(sql).not.toMatch(/\b(drop\s+table|truncate|reset\s+database)\b/i);
      expect(sql).toContain("schema_migrations");
    }
    expect(read(paths[0])).toContain("effective_artist_access");
    expect(read(paths[1])).toContain("my_work_inbox");
    expect(read(paths[1])).toContain("preview_artist_member_offboarding");
    expect(read(paths[2])).toContain("ensure_artist_team_room");
    expect(read(paths[3])).toContain("my_artist_schedule");
    expect(read(paths[4])).toContain("install_pro_starter_kits");
    expect(read(paths[5])).toContain("artist_team_requests");
    expect(read(paths[6])).toContain("v2:manager:template:weekly-review");
  });

  it("upserts team-room participants on the live conversation unique key", () => {
    const original = read("migrations/103_team_brief_and_room.sql");
    const fix = read("migrations/110_fix_team_room_participant_conflict.sql");
    expect(original).toContain("on conflict(conversation_id,profile_id)");
    expect(fix).toContain("on conflict(conversation_id,user_id)");
    expect(fix).not.toContain("on conflict(conversation_id,profile_id)");
    expect(fix).toContain("schema_migrations");
    expect(fix).not.toMatch(/\b(drop\s+table|truncate|reset\s+database)\b/i);
  });

  it("replays the calendar creator backfill atomically without the legacy owner trigger", () => {
    const sql = read("migrations/104_pro_operations.sql");
    const dropValidator = sql.indexOf("drop trigger if exists trg_validate_calendar_event on calendar_events;");
    const dropTimestamp = sql.indexOf("drop trigger if exists trg_calendar_event_updated_at on calendar_events;");
    const backfill = sql.indexOf("update calendar_events set created_by_user_id=user_id");
    const restoreValidator = sql.indexOf("create trigger trg_validate_calendar_event", backfill);
    const restoreTimestamp = sql.indexOf("create trigger trg_calendar_event_updated_at", backfill);

    expect(sql).toMatch(/^--[\s\S]*\nbegin;/);
    expect(dropValidator).toBeGreaterThan(-1);
    expect(dropTimestamp).toBeGreaterThan(dropValidator);
    expect(backfill).toBeGreaterThan(dropTimestamp);
    expect(restoreValidator).toBeGreaterThan(backfill);
    expect(restoreTimestamp).toBeGreaterThan(restoreValidator);
    expect(sql.trimEnd()).toMatch(/commit;$/);
  });

  it("puts exact access in Pro invitations without artist-origin language", () => {
    const message = renderTeamInviteEmail({
      email: "maya@example.com",
      artistName: "President",
      role: "manager",
      invitedByEmail: "owner@example.com",
      inviteUrl: "https://tempo.test/team-invite/token",
      expiresAt: null,
      areas: ROLE_PRESETS.manager,
      relationshipLabel: "Day-to-day manager",
      inviteMessage: "Help us coordinate the next release.",
    });
    expect(message.text).toContain("Tasks: write");
    expect(message.text).toContain("Day-to-day manager");
    expect(message.text).toContain("Help us coordinate");
    expect(message.text).not.toMatch(/artist origin|introduce your artist/i);
  });

  it("wires the mode-aware Team surface and review-before-approval flow", () => {
    const teamPage = read("app/(app)/team/page.tsx");
    expect(teamPage).toContain('label: "My Work"');
    expect(teamPage).toContain('label: "Schedule"');
    expect(teamPage).toContain('label: "Brief"');
    expect(teamPage).toContain('label: "Waiting"');
    const invites = read("components/team/pending-team-invites.tsx");
    expect(invites).toContain("Review access");
    expect(invites).toContain("reviewing !== invite.id");
  });

  it("keeps Pro-initiated team requests separate from access grants", () => {
    const migration = read("migrations/106_artist_team_requests.sql");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("requester_user_id = auth.uid()");
    expect(migration).toContain("a.user_id = auth.uid()");
    expect(migration).not.toMatch(/create policy[\s\S]{0,120}for insert/i);

    const createRoute = read("app/api/team-request/route.ts");
    expect(createRoute).toContain('.eq("profile_kind", "pro")');
    expect(createRoute).toContain('.in("visibility", ["members", "public"])');
    expect(createRoute).toContain('workspace_kind !== "artist"');

    const respondRoute = read("app/api/team-request/[id]/respond/route.ts");
    expect(respondRoute).toContain("createMemberInvite");
    expect(respondRoute).toContain('status: "invited"');
    expect(respondRoute).not.toContain('status: "active"');
  });

  it("puts discovery on the Pro roster and artist review on People", () => {
    const teamPage = read("app/(app)/team/page.tsx");
    expect(teamPage).toContain("<ProTeamRequests />");
    expect(teamPage).toContain("<ArtistTeamRequests");
    expect(read("components/team/pro-team-requests.tsx")).toContain("Request to join an artist team");
    expect(read("components/team/artist-team-requests.tsx")).toContain("Approve & send invitation");
  });

  it("ships substantial v2 starter kits with a detailed preview", () => {
    const migration = read("migrations/107_richer_pro_starter_kits.sql");
    for (const key of ["manager", "label", "publicist", "tour_manager", "agent", "assistant", "custom"]) {
      expect(migration.match(new RegExp(`\\('${key}',2`, "g"))?.length).toBeGreaterThanOrEqual(9);
    }
    expect(migration).toContain("Release readiness gate");
    expect(migration).toContain("Press campaign kickoff");
    expect(migration).toContain("Venue advance");
    expect(migration).toContain("Offer comparison");
    expect(migration).toContain("Daily desk reset");
    expect(migration).toContain("Weekly operating reset");

    const setup = read("components/team/starter-kit-setup.tsx");
    expect(setup).toContain("6 core items · 2 examples");
    expect(setup).toContain("See checklist");
    expect(setup).toContain('queryKey: ["templates"]');
    expect(setup).toContain('queryKey: ["tasks"]');
  });
});
