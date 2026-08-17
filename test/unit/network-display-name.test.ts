import { describe, expect, it } from "vitest";
import { resolveNetworkDisplayName } from "@/lib/social/network-display-name";

describe("network display name", () => {
  it("uses the confirmed onboarding name before an email-derived profile name", () => {
    expect(
      resolveNetworkDisplayName({
        requested: "Nikita Page",
        existingProfile: "nikita10",
        artist: "nikita10",
        email: "nikita10@example.com",
      })
    ).toBe("Nikita Page");
  });

  it("uses a saved member profile when no name is supplied by the join form", () => {
    expect(
      resolveNetworkDisplayName({
        memberProfile: "Nick Miller",
        existingProfile: "music",
        email: "music@example.com",
      })
    ).toBe("Nick Miller");
  });

  it("preserves a real existing profile name for ordinary joins", () => {
    expect(
      resolveNetworkDisplayName({
        existingProfile: "The President",
        artist: "Home",
        email: "hello@example.com",
      })
    ).toBe("The President");
  });
});
