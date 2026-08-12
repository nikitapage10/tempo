import { describe, expect, it } from "vitest";
import {
  losslessVaultSiblings,
  mp3FilenameForOriginal,
  needsMp3Conversion,
} from "@/lib/audio-convert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("desktop lossless → cloud mp3", () => {
  it("maps cloud mp3 paths back to possible vault originals", () => {
    expect(
      losslessVaultSiblings(
        "tracks/t/versions/v/mix.mp3"
      )
    ).toEqual([
      "tracks/t/versions/v/mix.wav",
      "tracks/t/versions/v/mix.aiff",
      "tracks/t/versions/v/mix.aif",
    ]);
    expect(losslessVaultSiblings("tracks/t/versions/v/mix.m4a")).toEqual([]);
  });

  it("names the cloud twin from the original bounce", () => {
    expect(mp3FilenameForOriginal("Final Bounce.wav")).toBe("Final Bounce.mp3");
    expect(mp3FilenameForOriginal("master.AIFF")).toBe("master.mp3");
  });

  it("still detects lossless uploads that need a cloud mp3", () => {
    expect(
      needsMp3Conversion(
        new File([""], "x.wav", { type: "audio/wav" })
      )
    ).toBe(true);
    expect(
      needsMp3Conversion(
        new File([""], "x.mp3", { type: "audio/mpeg" })
      )
    ).toBe(false);
  });

  it("keeps the original in the desktop vault and converts only for cloud", () => {
    const versions = readFileSync(
      resolve("lib/api/versions.ts"),
      "utf8"
    );
    expect(versions).toContain("desktop && lossless");
    expect(versions).toContain("skipVault: true");
    expect(versions).toContain("mp3FilenameForOriginal");
    expect(versions).toContain("vaultWrite");
    expect(versions).toContain("convertLosslessToMp3");

    const storage = readFileSync(resolve("lib/storage.ts"), "utf8");
    expect(storage).toContain("losslessVaultSiblings(path)");
    expect(storage).toContain("skipVault");
  });
});
