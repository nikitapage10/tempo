import { afterEach, describe, expect, it } from "vitest";
import {
  formatFromHeader,
  inviteDeliveryConfig,
  linkDomainAligned,
  parseFromAddress,
  renderInviteEmail,
  resolveReplyTo,
} from "@/lib/admin/invite-email";

const envKeys = ["RESEND_API_KEY", "INVITE_FROM_EMAIL", "INVITE_REPLY_TO_EMAIL", "NEXT_PUBLIC_SITE_URL"] as const;
const envSnapshot = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of envKeys) {
    const value = envSnapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("invite email", () => {
  it("leads with Download TEMPO and keeps web as a secondary path", () => {
    const { html, text, subject } = renderInviteEmail({
      code: "TEMPO-TEST",
      email: "artist@example.com",
      memberRole: "artist",
      welcomeNote: null,
      expiresAt: null,
    });

    expect(subject).toBe("You’re invited to TEMPO");
    expect(html.indexOf("Download TEMPO")).toBeLessThan(html.indexOf("Use the web app"));
    expect(html).toContain("If a button doesn’t work, copy one of these addresses");
    expect(html).toContain("/download");
    expect(html).toContain("/register?invite=");
    expect(html).not.toContain("radial-gradient");
    expect(text.indexOf("Download TEMPO:")).toBeLessThan(text.indexOf("Use the web app:"));
    expect(text).toContain("If a button doesn’t work, copy one of the addresses above.");
  });

  it("formats From and reply-to for Resend", () => {
    expect(parseFromAddress("TEMPO <connect@nikita.page>")).toBe("connect@nikita.page");
    expect(formatFromHeader("connect@nikita.page")).toBe("TEMPO <connect@nikita.page>");
    expect(formatFromHeader("TEMPO Invites <connect@nikita.page>")).toBe("TEMPO Invites <connect@nikita.page>");
    expect(resolveReplyTo("connect@nikita.page")).toBe("connect@nikita.page");
    expect(resolveReplyTo("TEMPO <connect@nikita.page>", "music@nikita.page")).toBe("music@nikita.page");
  });

  it("treats subdomains of the sending domain as aligned", () => {
    expect(linkDomainAligned("app.nikita.page", "nikita.page")).toBe(true);
    expect(linkDomainAligned("nikita.page", "nikita.page")).toBe(true);
    expect(linkDomainAligned("mytempo.dev", "nikita.page")).toBe(false);
    expect(linkDomainAligned("mytempo.dev", "mytempo.dev")).toBe(true);
  });

  it("exposes linkDomainAligned on delivery config", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INVITE_FROM_EMAIL = "connect@nikita.page";
    process.env.NEXT_PUBLIC_SITE_URL = "https://mytempo.dev";
    const mismatched = inviteDeliveryConfig();
    expect(mismatched.configured).toBe(true);
    expect(mismatched.from).toBe("TEMPO <connect@nikita.page>");
    expect(mismatched.domain).toBe("nikita.page");
    expect(mismatched.siteHost).toBe("mytempo.dev");
    expect(mismatched.linkDomainAligned).toBe(false);
    expect(mismatched.replyTo).toBe("connect@nikita.page");

    process.env.NEXT_PUBLIC_SITE_URL = "https://app.nikita.page";
    expect(inviteDeliveryConfig().linkDomainAligned).toBe(true);
  });
});
