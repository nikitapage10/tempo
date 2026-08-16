import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ARTIST_KEY,
  ACTIVE_SPACE_KEY,
  PREFER_ORIGIN_ARTIST_KEY,
} from "@/lib/constants";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    get size() {
      return store.size;
    },
  };
}

describe("account switch session reset", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("clears the previous account's workspace keys, query cache, and signed URLs", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    local.setItem(ACTIVE_ARTIST_KEY, "artist-from-other-account");
    local.setItem(ACTIVE_SPACE_KEY, "space-from-other-account");
    local.setItem(`${ACTIVE_ARTIST_KEY}:user-president`, "president-artist");
    local.setItem("tempo.contentZoom", "1.1");
    session.setItem(PREFER_ORIGIN_ARTIST_KEY, "origin-artist");
    session.setItem("tempo.preferPersonalHome", "personal-home");
    session.setItem("tempo:signed-url-cache:v1", JSON.stringify({ keep: "no" }));
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);

    const { cacheSignedUrl, peekSignedUrl } = await import("@/lib/storage");
    cacheSignedUrl("artists/other/emblem/x.jpg", "https://cdn.example/other");
    expect(peekSignedUrl("artists/other/emblem/x.jpg")).toBe(
      "https://cdn.example/other"
    );

    const { resetClientSession } = await import(
      "@/lib/auth/reset-client-session"
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(["artists"], [{ id: "artist-from-other-account" }]);
    queryClient.setQueryData(["admin", "access"], false);

    await resetClientSession(queryClient);

    expect(queryClient.getQueryData(["artists"])).toBeUndefined();
    expect(queryClient.getQueryData(["admin", "access"])).toBeUndefined();
    expect(local.getItem(ACTIVE_ARTIST_KEY)).toBeNull();
    expect(local.getItem(ACTIVE_SPACE_KEY)).toBeNull();
    expect(local.getItem(`${ACTIVE_ARTIST_KEY}:user-president`)).toBe(
      "president-artist"
    );
    expect(local.getItem("tempo.contentZoom")).toBe("1.1");
    expect(session.getItem(PREFER_ORIGIN_ARTIST_KEY)).toBe("origin-artist");
    expect(session.getItem("tempo.preferPersonalHome")).toBe("personal-home");
    expect(peekSignedUrl("artists/other/emblem/x.jpg")).toBeNull();
  });

  it("refuses to restore another account's desktop offline cache", async () => {
    const { canRestoreOfflineCache, entryBelongsToUser } = await import(
      "@/lib/offline/query-persistence"
    );
    expect(canRestoreOfflineCache("user-b", "user-a")).toBe(false);
    expect(canRestoreOfflineCache("user-a", "user-a")).toBe(true);
    expect(canRestoreOfflineCache(null, "user-a")).toBe(false);
    expect(canRestoreOfflineCache("user-a", null)).toBe(false);
    expect(
      entryBelongsToUser({ userId: "user-a" }, "user-a")
    ).toBe(true);
    expect(
      entryBelongsToUser({ userId: "user-a" }, "user-b")
    ).toBe(false);
    expect(entryBelongsToUser({}, "user-a")).toBe(false);
    expect(entryBelongsToUser({ userId: "user-a" }, null)).toBe(false);
  });

  it("signs out and reloads from every account menu, then starts the next login clean", () => {
    const read = (path: string) => readFileSync(resolve(path), "utf8");

    const menu = read("components/profile-menu.tsx");
    const account = read("components/settings/account-panel.tsx");
    const legal = read("components/legal/legal-acceptance-form.tsx");
    const login = read("app/login/page.tsx");
    const register = read("app/register/page.tsx");
    const callback = read("app/auth/callback/page.tsx");
    const providers = read("components/providers.tsx");
    const admin = read("hooks/use-admin.ts");
    const artists = read("components/active-artist-provider.tsx");

    expect(menu).toContain("signOutOfTempo");
    expect(account).toContain("signOutOfTempo");
    expect(legal).toContain("signOutOfTempo");
    expect(login).toContain("finishAuthNavigation");
    expect(register).toContain("finishAuthNavigation");
    expect(callback).toContain("finishAuthNavigation");
    expect(providers).toContain("resetClientSession");
    expect(providers).toContain("onAuthStateChange");
    expect(providers).toContain("previousId && nextId");
    expect(admin).toContain('queryKey: ["admin", "access", user?.id ?? null]');
    expect(artists).toContain("enabled: hydrated && !!user?.id");
    expect(artists).toContain("pickResumeArtistId");
    expect(read("lib/auth/reset-client-session.ts")).toContain(
      "clearLegacyWorkspaceMemory"
    );
    expect(read("lib/auth/reset-client-session.ts")).toContain(
      "GUIDED_TOUR_PENDING_KEY"
    );
    expect(read("lib/auth/workspace-memory.ts")).toContain("artistMemoryKey");
  });
});
