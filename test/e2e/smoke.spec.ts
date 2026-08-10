import { test, expect } from "@playwright/test";

/**
 * Bounded PR-smoke tier: the smallest proof that auth + the app shell work
 * end to end against the isolated test Supabase project. Signs in through
 * the local-only /api/dev/session route (never a real password), which only
 * responds when NODE_ENV=development and the host is loopback — see
 * app/api/dev/session/route.ts.
 */
test("signs in and reaches the Today shell", async ({ page }) => {
  await page.goto("/api/dev/session");
  await expect(page).toHaveURL(/\/$/);

  // App shell nav should be visible once authenticated — a bare login form
  // would not have this text. Nav links carry a title tooltip too, so their
  // accessible name is "Board Move tracks..." etc. — match by href instead.
  await expect(page.locator('a[href="/board"]').first()).toBeVisible();
  await expect(page.locator('a[href="/tracks"]').first()).toBeVisible();
});

test("unauthenticated access to a protected route redirects to /login", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/board");
  await expect(page).toHaveURL(/\/login/);
});
