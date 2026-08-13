import { describe, expect, it } from "vitest";
import { renderInviteEmail } from "@/lib/admin/invite-email";

describe("invite email", () => {
  it("leads with Download TEMPO and keeps web as a secondary path", () => {
    const { html, text } = renderInviteEmail({
      code: "TEMPO-TEST",
      email: "artist@example.com",
      memberRole: "artist",
      welcomeNote: null,
      expiresAt: null,
    });

    expect(html.indexOf("Download TEMPO")).toBeLessThan(html.indexOf("Use the web app"));
    expect(html).toContain("If a button doesn’t work, copy one of these addresses");
    expect(html).toContain("/download");
    expect(html).toContain("/register?invite=");
    expect(text.indexOf("Download TEMPO:")).toBeLessThan(text.indexOf("Use the web app:"));
    expect(text).toContain("If a button doesn’t work, copy one of the addresses above.");
  });
});
