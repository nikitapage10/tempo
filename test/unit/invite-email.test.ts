import { describe, expect, it } from "vitest";
import { renderInviteEmail } from "@/lib/admin/invite-email";

describe("invite email", () => {
  it("offers desktop and browser as two full paths, desktop first", () => {
    const { html, text } = renderInviteEmail({
      code: "TEMPO-TEST",
      email: "artist@example.com",
      memberRole: "artist",
      welcomeNote: null,
      expiresAt: null,
    });

    expect(html.indexOf("Get the desktop app")).toBeLessThan(
      html.indexOf("Open TEMPO in your browser")
    );
    expect(html).toContain("If a button doesn’t work, copy one of these addresses");
    expect(html).toContain("/download");
    expect(html).toContain("/register?invite=");
    expect(text.indexOf("Get the desktop app:")).toBeLessThan(
      text.indexOf("Open TEMPO in your browser:")
    );
    expect(text).toContain("If a button doesn’t work, copy one of the addresses above.");
  });

  /**
   * Neither path may be described as the lesser one. The browser is the whole
   * app, and an invite that frames it as a fallback loses the people who are
   * not going to install anything today.
   */
  it("does not frame the browser as a fallback", () => {
    const { html, text } = renderInviteEmail({
      code: "TEMPO-TEST",
      email: "artist@example.com",
      memberRole: "artist",
      welcomeNote: null,
      expiresAt: null,
    });

    for (const body of [html, text]) {
      expect(body).toContain("both are the full thing");
      expect(body).toContain("Same account either way");
      expect(body).not.toContain("Start by installing");
      expect(body).not.toContain("if you prefer the browser");
    }
  });

  it("welcomes Pros through Passage without artist Origin language", () => {
    const pro = renderInviteEmail({
      code: "TEMPO-PRO",
      email: "manager@example.com",
      memberRole: "team_member",
      welcomeNote: null,
      expiresAt: null,
    });
    const artist = renderInviteEmail({
      code: "TEMPO-ARTIST",
      email: "artist@example.com",
      memberRole: "artist",
      welcomeNote: null,
      expiresAt: null,
    });

    expect(pro.html).toContain("Step into the work around the music.");
    for (const body of [pro.html, pro.text]) {
      expect(body).toContain("Introduce yourself through Passage");
      expect(body).toContain("professional home");
      expect(body).not.toContain("Introduce your artist through Origin");
      expect(body).not.toContain("keep every bounce");
    }

    for (const body of [artist.html, artist.text]) {
      expect(body).toContain("Introduce your artist through Origin");
      expect(body).not.toContain("Introduce yourself through Passage");
    }
  });
});
