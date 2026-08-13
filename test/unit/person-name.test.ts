import { describe, expect, it } from "vitest";
import {
  isPlaceholderPersonName,
  normalizePersonDisplayName,
} from "@/lib/auth/person-name";

describe("person display name", () => {
  it("trims and rejects empty or one-character names", () => {
    expect(normalizePersonDisplayName("  Nick Miller  ")).toBe("Nick Miller");
    expect(normalizePersonDisplayName("  ")).toBeNull();
    expect(normalizePersonDisplayName("A")).toBeNull();
  });

  it("treats Home, Your work, and the email local-part as placeholders", () => {
    expect(isPlaceholderPersonName("Home")).toBe(true);
    expect(isPlaceholderPersonName("Your work")).toBe(true);
    expect(isPlaceholderPersonName("music", "music@nikita.page")).toBe(true);
    expect(isPlaceholderPersonName("Nick Miller", "music@nikita.page")).toBe(false);
  });
});
