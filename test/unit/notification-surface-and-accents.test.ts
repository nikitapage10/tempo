import { describe, expect, it } from "vitest";
import { normalizeAccentHex } from "@/lib/desktop/bridge";
import { isMessagesSurface } from "@/lib/notifications/surface";

describe("isMessagesSurface", () => {
  it("treats Messages routes as the quiet surface", () => {
    expect(isMessagesSurface("/messages")).toBe(true);
    expect(isMessagesSurface("/messages/abc")).toBe(true);
    expect(isMessagesSurface("/today")).toBe(false);
    expect(isMessagesSurface("/social")).toBe(false);
    expect(isMessagesSurface(null)).toBe(false);
  });
});

describe("normalizeAccentHex", () => {
  it("normalizes hex and rgb into #RRGGBB for glass alerts", () => {
    expect(normalizeAccentHex("#7fb4ff")).toBe("#7FB4FF");
    expect(normalizeAccentHex("#abc")).toBe("#AABBCC");
    expect(normalizeAccentHex("ffb56b")).toBe("#FFB56B");
    expect(normalizeAccentHex("rgb(127, 180, 255)")).toBe("#7FB4FF");
    expect(normalizeAccentHex("  #9D8CFF  ")).toBe("#9D8CFF");
    expect(normalizeAccentHex("not-a-color")).toBeNull();
  });
});
