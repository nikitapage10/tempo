import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Session desk contracts", () => {
  it("keeps the stage, deck, console, rack, and chat as separate room pieces", () => {
    const shell = read("components/sessions/session-room-shell.tsx");
    expect(shell).toContain("<SessionHeader");
    expect(shell).toContain("<SessionStage");
    expect(shell).toContain("<SessionDeck");
    expect(shell).toContain("<CallConsole");
    expect(shell).toContain("<SessionRack");
    expect(shell).toContain("<SessionChatPanel");
  });

  it("keeps mobile stage height and deck keyboard controls accessible", () => {
    const shell = read("components/sessions/session-room-shell.tsx");
    const deck = read("components/sessions/session-deck.tsx");
    expect(shell).toContain("max-h-[40dvh]");
    expect(deck).toContain('role="slider"');
    expect(deck).toContain("tabIndex={0}");
    expect(deck).toContain('event.key === "ArrowLeft"');
    expect(deck).toContain('event.key.toLowerCase() === "m"');
  });

  it("freezes the room wash for reduced motion", () => {
    const header = read("components/sessions/session-header.tsx");
    expect(header).toContain("prefers-reduced-motion: reduce");
    expect(header).toContain("reducedMotion ? 0.14");
    expect(header).toContain("motion-reduce:transition-none");
  });
});
