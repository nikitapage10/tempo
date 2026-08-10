import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnvFile } from "../support/e2e-env";

/**
 * End-to-end proof of the product-events ingestion pipeline: authenticated
 * POST -> validated insert -> real row in the isolated test project, plus
 * the dedupe_key unique constraint collapsing a repeat send.
 */
test("authenticated event POST results in a real, deduped row", async ({ page }) => {
  await page.goto("/api/dev/session");

  const dedupeKey = `e2e-test:${Date.now()}`;
  const post = () =>
    page.request.post("/api/product-events", {
      data: {
        event_name: "workflow_intent_set",
        properties: { intent_type: "next_move", source_surface: "track" },
        dedupe_key: dedupeKey,
      },
    });

  const first = await post();
  expect(first.status()).toBe(204);
  const second = await post(); // should be swallowed as a duplicate, not error
  expect(second.status()).toBe(204);

  const env = loadTestEnvFile();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("product_events")
    .select("id, event_name, properties")
    .eq("dedupe_key", dedupeKey);

  expect(error).toBeNull();
  expect(data).toHaveLength(1); // exactly one row despite two POSTs
  expect(data?.[0].event_name).toBe("workflow_intent_set");
  expect(data?.[0].properties).toEqual({ intent_type: "next_move", source_surface: "track" });
});

test("unknown event name is silently ignored, never 500s", async ({ page }) => {
  await page.goto("/api/dev/session");
  const res = await page.request.post("/api/product-events", {
    data: { event_name: "not_a_real_event", properties: {} },
  });
  expect(res.status()).toBe(204);
});

test("a prohibited property (e.g. a title) never reaches the stored row", async ({ page }) => {
  await page.goto("/api/dev/session");
  const dedupeKey = `e2e-test-strip:${Date.now()}`;
  await page.request.post("/api/product-events", {
    data: {
      event_name: "first_track_created",
      properties: { creation_path: "manual", track_title: "Secret Song Title" },
      dedupe_key: dedupeKey,
    },
  });

  const env = loadTestEnvFile();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from("product_events")
    .select("properties")
    .eq("dedupe_key", dedupeKey)
    .single();

  expect(data?.properties).toEqual({ creation_path: "manual" });
  expect(JSON.stringify(data?.properties)).not.toContain("Secret Song Title");
});
