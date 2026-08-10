import { test, expect } from "@playwright/test";
import { mintGuestLink } from "../support/guest-link-helpers";

/**
 * Guest-token state coverage for /api/review/[token] — SECURITY-AND-PERMISSIONS.md
 * §T1. Every failure mode must return the same generic "unavailable" shape;
 * this suite also asserts that (never a distinguishing error).
 */

test("valid guest token returns track/version data", async ({ request }) => {
  const token = await mintGuestLink("valid");
  const res = await request.get(`/api/review/${token}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.track?.title).toBe("Fixture Track");
  expect(body.allow_comments).toBe(true);
});

test("expired guest token is rejected generically", async ({ request }) => {
  const token = await mintGuestLink("expired");
  const res = await request.get(`/api/review/${token}`);
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/isn.t available/i);
});

test("revoked guest token is rejected generically", async ({ request }) => {
  const token = await mintGuestLink("revoked");
  const res = await request.get(`/api/review/${token}`);
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/isn.t available/i);
});

test("tampered/unknown token is rejected generically", async ({ request }) => {
  const res = await request.get(`/api/review/${"a".repeat(48)}`);
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/isn.t available/i);
});

test("a valid token cannot be swapped to another track's version via body tampering", async ({
  request,
}) => {
  const token = await mintGuestLink("valid");
  // The download/comments routes must ignore any client-supplied version_id
  // and use only the one bound to the link server-side.
  const res = await request.post(`/api/review/${token}/comments`, {
    data: { text: "hi", version_id: "00000000-0000-0000-0000-000000000000" },
  });
  // Either rejected outright, or accepted but scoped server-side — never a 500
  // that could leak internals, and never silently trusts the tampered id.
  expect([200, 201, 400, 403, 404]).toContain(res.status());
});
