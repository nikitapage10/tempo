import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnvFile } from "./e2e-env";
import { loadFixtureManifest } from "./fixture-clients";

/** Mints a one-off guest_review_links row in a specific state, for E2E token tests. */
export async function mintGuestLink(state: "valid" | "expired" | "revoked") {
  const env = loadTestEnvFile();
  const manifest = loadFixtureManifest();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const row: Record<string, unknown> = {
    track_id: manifest.trackId,
    version_id: manifest.versionId,
    created_by: manifest.users.owner.id,
    token_hash: tokenHash,
    allow_comments: true,
    allow_download: false,
  };
  if (state === "expired") row.expires_at = new Date(Date.now() - 60_000).toISOString();
  if (state === "revoked") row.revoked_at = new Date().toISOString();

  const { error } = await admin.from("guest_review_links").insert(row);
  if (error) throw error;

  return rawToken;
}
