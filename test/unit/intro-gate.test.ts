import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTRO_DAY_KEY,
  SUPPRESS_INTRO_KEY,
  introDayKey,
  introDocumentIsHidden,
  introWillPlay,
  markIntroPlayed,
} from "@/lib/intro";

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
  };
}

describe("boot intro day gate", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWindow({
    reduced = false,
    hidden = false,
  }: { reduced?: boolean; hidden?: boolean } = {}) {
    const local = memoryStorage();
    const session = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: reduced && query.includes("prefers-reduced-motion"),
      }),
    });
    vi.stubGlobal("document", {
      visibilityState: hidden ? "hidden" : "visible",
    });
    return { local, session };
  }

  it("plays when the day has not been marked", () => {
    stubWindow();
    expect(introWillPlay()).toBe(true);
  });

  it("does not treat a hidden window as already played", () => {
    stubWindow({ hidden: true });
    expect(introWillPlay()).toBe(true);
    expect(introDocumentIsHidden()).toBe(true);
  });

  it("stops playing after markIntroPlayed for today", () => {
    const { local } = stubWindow();
    markIntroPlayed();
    expect(introWillPlay()).toBe(false);
    expect(local.getItem(INTRO_DAY_KEY)).toBe(introDayKey());
  });

  it("plays again on a later calendar day", () => {
    const { local } = stubWindow();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    local.setItem(INTRO_DAY_KEY, introDayKey(yesterday));
    expect(introWillPlay()).toBe(true);
  });

  it("stays suppressed for the Origin handoff session", () => {
    const { session } = stubWindow();
    session.setItem(SUPPRESS_INTRO_KEY, "1");
    expect(introWillPlay()).toBe(false);
  });

  it("skips under reduced motion", () => {
    stubWindow({ reduced: true });
    expect(introWillPlay()).toBe(false);
  });
});
