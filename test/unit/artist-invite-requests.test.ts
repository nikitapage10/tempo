import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("beta artist invite approval", () => {
  it("ships migration 093 for artist invite requests", () => {
    expect(existsSync(resolve("migrations/093_artist_invite_requests.sql"))).toBe(
      true
    );
    const sql = read("migrations/093_artist_invite_requests.sql");
    expect(sql).toContain("artist_invite_requests");
    expect(sql).toContain("pending");
    expect(sql).toContain("approved");
    expect(sql).toContain("rejected");
  });

  it("lets members request an artist invite without sending it", () => {
    const route = read("app/api/artist-invite-requests/route.ts");
    expect(route).toContain('select("id, user_id, space_id")');
    expect(route).not.toContain("artist_id, user_id");
    expect(route).toContain("notifyAdminsOfArtistInviteRequest");
    expect(route).not.toContain("deliverInvite");
  });

  it("approves by creating a platform invite and lists invites sent by others", () => {
    const approve = read(
      "app/api/admin/artist-invite-requests/[id]/approve/route.ts"
    );
    expect(approve).toContain("member_role: \"artist\"");
    expect(approve).toContain("deliverInvite");
    const adminInvites = read("app/api/admin/invites/route.ts");
    expect(adminInvites).toContain("listMemberInvites");
    expect(adminInvites).toContain("listArtistInviteRequests");
    const page = read("app/admin/invites/page.tsx");
    expect(page).toContain("Invites by others");
    expect(page).toContain("Needs approval");
  });

  it("offers a full-artist request from the track people panel", () => {
    const panel = read("components/track/people-panel.tsx");
    expect(panel).toContain("requestArtistInvite");
    expect(panel).toContain("Also ask TEMPO to invite them as a full artist");
  });
});
