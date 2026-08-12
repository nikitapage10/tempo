import { readFileSync } from "node:fs";
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

  it("offers artist, settings, download, and sign out", () => {
    expect(menu).toContain('href="/artist"');
    expect(menu).toContain('href="/stats"');
    expect(menu).toContain('href="/settings"');
    expect(menu).toContain('href="/download"');
    expect(menu).toContain("signOut");
    expect(menu).toContain("Sign out");
  });
});
