import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const intro = readFileSync(resolve("components/intro-moment.tsx"), "utf8");

describe("daily intro film", () => {
  it("uses the supplied film without a second soundtrack or wordmark", () => {
    expect(intro).not.toContain("TEMPO_THEME_SRC");
    expect(intro).not.toContain("<audio");
    expect(intro).not.toContain("CHARS.map");
    expect(intro).not.toContain('aria-label="TEMPO"');
  });

  it("plays the authored ending before transitioning into the workspace", () => {
    expect(intro).toContain('video.addEventListener("ended", onEnded)');
    expect(intro).not.toContain('video.addEventListener("timeupdate"');
    expect(intro).toContain('setPhase("melting")');
  });

  it("keeps a muted fallback when a browser blocks audible autoplay", () => {
    expect(intro).toContain("video.muted = true");
    expect(intro).toContain("return video.play()");
  });
});
