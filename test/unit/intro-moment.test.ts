import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const intro = readFileSync(resolve("components/intro-moment.tsx"), "utf8");
const css = readFileSync(resolve("app/globals.css"), "utf8");

describe("daily intro film", () => {
  it("uses the supplied film without a second soundtrack or wordmark", () => {
    expect(intro).not.toContain("TEMPO_THEME_SRC");
    expect(intro).not.toContain("<audio");
    expect(intro).not.toContain("CHARS.map");
    expect(intro).not.toContain('aria-label="TEMPO"');
  });

  it("plays the authored film, then fades into the workspace over the last two seconds", () => {
    expect(intro).toContain("FADE_OUT_SECONDS = 2");
    expect(intro).toContain('video.addEventListener("timeupdate", onTimeUpdate)');
    expect(intro).toContain('video.addEventListener("ended", onEnded)');
    expect(intro).toContain("beginFade");
    expect(intro).not.toContain("setPhase(\"melting\")");
  });

  it("keeps a grain overlay and a visible Skip control", () => {
    expect(intro).toContain('className="intro-grain"');
    expect(css).toContain(".intro-grain");
    expect(intro).toContain("bottom-8 left-1/2");
    expect(intro).toContain("Skip");
  });

  it("keeps a muted fallback when a browser blocks audible autoplay", () => {
    expect(intro).toContain("video.muted = true");
    expect(intro).toContain("return video.play()");
  });

  it("waits until the window is in front and does not burn the day on a hidden play", () => {
    expect(intro).toContain("introDocumentIsHidden");
    expect(intro).toContain("visibilitychange");
    expect(intro).toContain('visibilityState === "hidden"');
    expect(intro).toContain("markIntroPlayed");
    expect(intro).toContain("setIntroPending");
    expect(intro).not.toContain("localStorage.setItem(INTRO_DAY_KEY");
    expect(intro).toContain("started = false");
  });
});
