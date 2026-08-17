import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Passage panel legibility", () => {
  const panel = read("components/passage/passage-panel.ts");

  /** The exported class list, without the explanatory comment above it. */
  const classes = panel.slice(panel.indexOf("export const PASSAGE_PANEL"));

  it("uses an arbitrary rgb fill rather than a theme alpha modifier", () => {
    // Theme colours go through <alpha-value> indirection here, and alpha
    // modifiers on them have silently compiled to nothing before. The one
    // property carrying legibility must not be able to fail that way.
    expect(classes).toContain("bg-[rgb(10_10_12/0.96)]");
    expect(classes).not.toMatch(/bg-bg-0\/\d+/);
  });

  it("matches the app panel material", () => {
    expect(panel).toContain("rounded-panel");
    expect(panel).toContain("backdrop-blur-[20px]");
    expect(panel).toContain("backdrop-saturate-[1.1]");
  });

  it("is used by every question panel", () => {
    for (const file of [
      "passage-name-step",
      "passage-describe-step",
      "passage-text-step",
      "passage-processing-step",
    ]) {
      expect(read(`components/passage/${file}.tsx`)).toContain("PASSAGE_PANEL");
    }
  });
});

describe("Passage voice input", () => {
  const step = read("components/passage/passage-text-step.tsx");

  it("offers dictation on the open questions", () => {
    expect(step).toContain("useOriginSpeech");
    expect(step).toContain("Dictate");
  });

  it("keeps typing an equal path", () => {
    // The transcript stays an ordinary editable textarea, so a denied mic or
    // an unsupported browser costs nothing but the dictation itself.
    expect(step).toContain("<Textarea");
    expect(step).toContain("speech.mode !== \"unavailable\"");
    expect(step).toContain("speech.micDenied");
  });

  it("announces listening state politely rather than every word", () => {
    expect(step).toContain('aria-live="polite"');
  });
});

describe("Passage Tempo Theme bed", () => {
  const experience = read("components/passage/passage-experience.tsx");
  const stateHook = read("hooks/use-passage-state.ts");

  it("uses the shared onboarding soundtrack and starts it from Tune in", () => {
    expect(experience).toContain("SOUNDTRACK_SRC");
    expect(experience).toContain("<audio");
    expect(experience).toContain("ref={soundtrackRef}");
    expect(experience).toContain("src={SOUNDTRACK_SRC}");
    expect(experience).toContain("startPassageSound();");
  });

  it("starts resumed Passage audio on the first browser interaction or immediately on desktop", () => {
    expect(experience).toContain("if (isDesktopApp())");
    expect(experience).toContain(
      'window.addEventListener("pointerdown", startOnInteraction'
    );
    expect(experience).toContain(
      'window.addEventListener("keydown", startOnInteraction'
    );
    expect(experience).toContain('state.phase === "awaiting_start"');
  });

  it("does not create an empty draft that bypasses the Tune in screen", () => {
    expect(stateHook).toContain(
      'if (state.phase === "awaiting_start") return;'
    );
  });
});

describe("Passage onboarding controls", () => {
  const experience = read("components/passage/passage-experience.tsx");

  it("reveals the shared sign-out control after Tune in", () => {
    expect(experience).toContain("OriginExitControl");
    expect(experience).toContain("<OriginExitControl visible={soundOn} />");
  });

  it("holds sign-out until the opening has taken the frame", () => {
    const exit = read("components/origin/origin-exit-control.tsx");
    expect(exit).toContain("useOnboardingChromeReveal");
    expect(exit).toContain("ONBOARDING_CHROME_REVEAL_DELAY_MS = 2800");
    expect(exit).toContain("ONBOARDING_CHROME_FADE_IN_MS = 2000");
  });
});
