import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARTIST_NAME,
  normalizeDefaultArtistName,
} from "@/lib/constants";

describe("Origin default artist name", () => {
  it("uses Artist Name for new accounts", () => {
    expect(DEFAULT_ARTIST_NAME).toBe("Artist Name");
  });

  it("upgrades an unfinished legacy My Artist placeholder", () => {
    expect(normalizeDefaultArtistName("My Artist")).toBe("Artist Name");
    expect(normalizeDefaultArtistName("My Artist Is a Real Band")).toBe(
      "My Artist Is a Real Band"
    );
  });
});
