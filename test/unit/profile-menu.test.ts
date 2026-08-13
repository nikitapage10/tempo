import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("toolbar profile menu", () => {
  const shell = read("components/app-shell.tsx");
  const menu = read("components/profile-menu.tsx");

  it("places ProfileMenu beside Messages in the toolbar", () => {
    const messages = shell.indexOf("<MessageCenter />");
    const profile = shell.indexOf("<ProfileMenu />");
    const search = shell.indexOf('data-tour="global-search"');
    expect(messages).toBeGreaterThan(-1);
    expect(profile).toBeGreaterThan(messages);
    expect(profile).toBeLessThan(search);
  });

  it("offers artist, settings, platform handoff, and sign out", () => {
    expect(menu).toContain('href="/artist"');
    expect(menu).toContain('href="/profile"');
    expect(menu).toContain('href="/stats"');
    expect(menu).toContain('href="/settings"');
    expect(menu).toContain("resolveDesktopHandoff");
    expect(menu).toContain("Open web app");
    expect(menu).toContain("onOpenWebAppClick");
    expect(menu).toContain("Open TEMPO");
    expect(menu).toContain("Download TEMPO");
    expect(menu).toContain("usePlatformAdmin");
    expect(menu).toContain('href="/admin"');
    expect(menu).toContain("Admin portal");
    expect(menu).toContain("signOut");
    expect(menu).toContain("Sign out");
  });

  it("gates Admin portal on the lightweight access probe", () => {
    expect(existsSync(resolve("app/api/admin/access/route.ts"))).toBe(true);
    expect(read("app/api/admin/access/route.ts")).toContain("requireAdmin");
    expect(read("hooks/use-admin.ts")).toContain("checkPlatformAdminAccess");
    expect(menu).toContain("platformAdmin.data");
  });

  it("shows the artist emblem as the trigger and menu header photo", () => {
    expect(menu).toContain("activeArtist?.emblem_url");
    expect(menu).toContain("ArtistMark");
    expect(menu).toContain("fetchMyMemberProfile");
    expect(menu).toContain("size-full");
    expect(menu).toContain("overflow-hidden rounded-full");
  });
});
