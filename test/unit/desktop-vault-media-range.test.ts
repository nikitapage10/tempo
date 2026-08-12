import { describe, expect, it } from "vitest";
import {
  contentTypeForPath,
  parseByteRange,
} from "../../electron/vault-media-response.js";

describe("vault media Range parsing (desktop seek)", () => {
  it("maps common bounce extensions to audio MIME types", () => {
    expect(contentTypeForPath("x/bounce.mp3")).toBe("audio/mpeg");
    expect(contentTypeForPath("x/bounce.WAV")).toBe("audio/wav");
    expect(contentTypeForPath("x/art.png")).toBe("image/png");
  });

  it("parses open-ended and closed byte ranges", () => {
    expect(parseByteRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({
      start: 100,
      end: 199,
    });
    expect(parseByteRange("bytes=500-", 1000)).toEqual({
      start: 500,
      end: 999,
    });
  });

  it("rejects unsatisfiable ranges so Chromium gets 416", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=200-100", 1000)).toBe("unsatisfiable");
  });

  it("returns null when no Range header is present", () => {
    expect(parseByteRange(null, 1000)).toBeNull();
    expect(parseByteRange("", 1000)).toBeNull();
  });
});
