import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ARTIST_KEY,
  ACTIVE_SPACE_KEY,
  PREFER_DEMO_ARTIST_KEY,
} from "@/lib/constants";
import { artistMemoryKey, spaceMemoryKey } from "@/lib/auth/workspace-memory";
import { focusDemo } from "@/lib/api/demo";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

describe("demo startup for Pro accounts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scopes an explicit demo choice to the signed-in account and one handoff", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);

    focusDemo({ artistId: "demo-1", spaceId: "demo-space" }, "pro-1");

    expect(local.getItem(artistMemoryKey("pro-1"))).toBe("demo-1");
    expect(local.getItem(spaceMemoryKey("pro-1"))).toBe("demo-space");
    expect(local.getItem(ACTIVE_ARTIST_KEY)).toBeNull();
    expect(local.getItem(ACTIVE_SPACE_KEY)).toBeNull();
    expect(session.getItem(PREFER_DEMO_ARTIST_KEY)).toBe("demo-1");
  });

  it("returns a restored demo pointer to the Pro home unless demo entry was explicit", () => {
    const provider = readFileSync(
      resolve("components/active-artist-provider.tsx"),
      "utf8"
    );
    expect(provider).toContain("explicitDemoActiveRef");
    expect(provider).toContain("active?.demo_kind");
    expect(provider).toContain("setActiveArtistIdState(keeper.id)");
    expect(provider).toContain("sessionStorage.removeItem(PREFER_DEMO_ARTIST_KEY)");
  });
});
