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
});
