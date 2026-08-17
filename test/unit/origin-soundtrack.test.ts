import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("onboarding Tempo Theme playback", () => {
  const hook = read("hooks/use-origin-soundtrack.ts");
  const origin = read("components/origin/origin-experience.tsx");
  const passage = read("components/passage/passage-experience.tsx");

  it("keeps a failed Mac playback request armed and retries readiness races", () => {
    expect(hook).toContain('addEventListener("canplay", retry)');
    expect(hook).toContain('addEventListener("loadeddata", retry)');
    expect(hook).toContain('window.addEventListener("focus", retry)');
    expect(hook).toContain("window.setInterval");
    expect(hook).toContain("playPendingRef.current = false");
  });

  it("only considers the soundtrack started after playback succeeds", () => {
    expect(hook).toContain('addEventListener("playing", beginFade)');
    const tryPlay = hook.slice(hook.indexOf("const tryPlay"), hook.indexOf("React.useEffect"));
    expect(tryPlay).not.toContain("startedRef.current = true");
  });

  it("uses inline audio in both artist and Pro onboarding", () => {
    expect(origin).toContain("playsInline");
    expect(passage).toContain("playsInline");
  });
});
