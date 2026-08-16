import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHandle, suggestHandle, validateHandle } from "@/lib/social/handle";

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("handle normalization", () => {
  it("strips the @ people type and lowercases", () => {
    expect(normalizeHandle("  @Nikita  ")).toBe("nikita");
  });

  it("turns spaces into underscores rather than rejecting them", () => {
    expect(normalizeHandle("The President")).toBe("the_president");
  });
});

describe("handle validation", () => {
  it("accepts the shapes migration 028 allows", () => {
    for (const handle of ["abc", "the_president", "a.b_c9", "a".repeat(30)]) {
      expect(validateHandle(handle)).toEqual({ ok: true, handle });
    }
  });

  it("rejects empty, short, long, edge-punctuated and illegal characters", () => {
    for (const handle of ["", "ab", "a".repeat(31), ".abc", "abc.", "_abc", "abc_", "ab c!"]) {
      expect(validateHandle(handle).ok).toBe(false);
    }
  });

  it("explains the rule instead of surfacing a constraint name", () => {
    const result = validateHandle("ab");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toMatch(/constraint|artist_profiles/i);
    }
  });
});

describe("handle suggestion", () => {
  it("draws a usable starting point from the artist name", () => {
    expect(suggestHandle("The President")).toBe("the_president");
    expect(suggestHandle("A.B.")).toBe("a.b");
  });

  it("returns nothing rather than a handle too short to use", () => {
    expect(suggestHandle("A")).toBe("");
    expect(suggestHandle(null)).toBe("");
  });
});

/**
 * The API is the only door onto the network, so the requirement has to hold
 * there and not merely in the forms that call it.
 */
describe("network join route", () => {
  const route = read("app/api/network/join/route.ts");

  it("refuses to publish a profile without a handle", () => {
    expect(route).toContain("needsHandle: true");
    expect(route).toContain("Pick a handle to join the network.");
  });

  it("validates the handle and rejects one already taken", () => {
    expect(route).toContain("validateHandle(requestedHandle)");
    expect(route).toContain("is already taken.");
  });

  it("writes the handle onto the profile it publishes", () => {
    expect(route).toContain("visibility, published_at: publishedAt, handle");
  });
});
