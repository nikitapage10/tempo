import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHandle, suggestHandle, validateHandle } from "@/lib/social/handle";

function read(relative: string) {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("handle normalization", () => {
  it("strips the @ people type and lowercases", () => {
    expect(normalizeHandle("  @Nikita  ")).toBe("nikita");
  });

  it("turns spaces into underscores rather than rejecting them", () => {
    expect(normalizeHandle("The President")).toBe("the_president");
  });
});

describe("handle validation", () => {
  it("accepts the shapes migration 028 allows", () => {
    for (const handle of ["abc", "the_president", "a.b_c9", "a".repeat(30)]) {
      expect(validateHandle(handle)).toEqual({ ok: true, handle });
    }
  });

  it("rejects empty, short, long, edge-punctuated and illegal characters", () => {
    for (const handle of ["", "ab", "a".repeat(31), ".abc", "abc.", "_abc", "abc_", "ab c!"]) {
      expect(validateHandle(handle).ok).toBe(false);
    }
  });

  it("explains the rule instead of surfacing a constraint name", () => {
    const result = validateHandle("ab");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toMatch(/constraint|artist_profiles/i);
    }
  });
});

describe("handle suggestion", () => {
  it("draws a usable starting point from the artist name", () => {
    expect(suggestHandle("The President")).toBe("the_president");
    expect(suggestHandle("A.B.")).toBe("a.b");
  });

  it("returns nothing rather than a handle too short to use", () => {
    expect(suggestHandle("A")).toBe("");
    expect(suggestHandle(null)).toBe("");
  });
});

describe("choosing a handle", () => {
  const field = read("components/social/handle-field.tsx");
  const panel = read("components/social/network-choice-panel.tsx");
  const dialog = read("components/social/join-network-dialog.tsx");
  const step = read("components/origin/origin-look-step.tsx");

  it("never types a handle into the field on someone's behalf", () => {
    // A handle is permanent and public. Pre-filling it from the artist name
    // meant pressing Next accepted a name nobody had chosen.
    expect(panel).not.toContain("onHandleChange(suggestHandle(artistName))");
    expect(dialog).not.toContain("currentHandle ?? suggestHandle(artistName)");
    expect(dialog).toContain('setHandle(currentHandle ?? "")');
  });

  it("offers the artist name as one tap instead", () => {
    expect(panel).toContain("suggestion={suggestHandle(artistName)}");
    expect(dialog).toContain("suggestion={suggestHandle(artistName)}");
    // Only while the field is empty, so it never competes with their own text.
    expect(field).toContain("{suggestion && !normalized ? (");
    expect(field).toContain("Use @{suggestion}");
  });

  it("says what is missing rather than leaving Continue dead", () => {
    expect(step).toContain("Type the handle you want before you continue.");
    expect(step).toContain('document.getElementById("origin-network-handle")?.focus()');
    // The button no longer disables itself on an unready handle; pressing it
    // is what surfaces the reason.
    expect(step).not.toContain('networkChoice === "join" && !handleState.ready');
    expect(step).toContain("setHandleProblem(null)");
  });

  it("shows the refusal in red, on the field itself", () => {
    expect(field).toContain("problem?: string | null;");
    expect(field).toContain('role={problem || message ? "alert" : undefined}');
    expect(field).toContain('problem || message ? "text-warn" : "text-text-lo/80"');
    expect(field).toContain('aria-invalid={status === "taken" || status === "invalid" || Boolean(problem)}');
  });

  it("checks availability while typing on profile edit and in Settings", () => {
    // Finding out a handle is taken only after Save is how people keep a
    // name they never meant to claim. The same live field used at join
    // now sits in both profile editors and Account settings.
    const artist = read("app/(app)/artist/page.tsx");
    const pro = read("components/profile/pro-identity-profile.tsx");
    const settings = read("components/settings/handle-panel.tsx");
    const account = read("components/settings/account-panel.tsx");
    for (const source of [artist, pro, settings]) {
      expect(source).toContain("HandleField");
      expect(source).toContain("onStateChange");
    }
    expect(artist).toContain("handleBlocksSave");
    expect(pro).toContain("handleBlocksSave");
    expect(field).toContain("is already taken.");
    expect(field).toContain("is available.");
    expect(account).toContain("<HandlePanel />");
  });
});

/**
 * The API is the only door onto the network, so the requirement has to hold
 * there and not merely in the forms that call it.
 */
describe("network join route", () => {
  const route = read("app/api/network/join/route.ts");

  it("refuses to publish a profile without a handle", () => {
    expect(route).toContain("needsHandle: true");
    expect(route).toContain("Pick a handle to join the network.");
  });

  it("validates the handle and rejects one already taken", () => {
    expect(route).toContain("validateHandle(requestedHandle)");
    expect(route).toContain("is already taken.");
  });

  it("writes the handle onto the profile it publishes", () => {
    expect(route).toContain("visibility, published_at: publishedAt, handle");
  });

  it("writes the confirmed name before onboarding creates automatic follows", () => {
    expect(route).toContain("resolveNetworkDisplayName");
    expect(route).toContain("display_name: displayName");
    expect(route.indexOf("display_name: displayName")).toBeLessThan(
      route.indexOf('service.rpc("provision_member_onboarding"')
    );
  });
});
