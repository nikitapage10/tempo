import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCollaboratorHandle } from "@/lib/api/collaborators";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("track collaborator include", () => {
  it("normalizes typed handles", () => {
    expect(normalizeCollaboratorHandle("  @President ")).toBe("president");
    expect(normalizeCollaboratorHandle("nikita")).toBe("nikita");
  });

  it("lets the People tab include a TEMPO artist or invite by email", () => {
    const panel = read("components/track/people-panel.tsx");
    expect(panel).toContain('TEMPO artist');
    expect(panel).toContain("Invite by email");
    expect(panel).toContain("includeArtist");
    expect(panel).toContain("People you follow");
    const api = read("lib/api/collaborators.ts");
    expect(api).toContain("includeArtistCollaborator");
    expect(api).toContain('status: "active"');
  });
});
