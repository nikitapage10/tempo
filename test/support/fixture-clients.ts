import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type FixtureRole =
  | "owner"
  | "editor"
  | "uploader"
  | "commenter"
  | "viewer"
  | "unauthorized";

type FixtureManifest = {
  password: string;
  users: Record<FixtureRole, { id: string; email: string }>;
  artistId: string;
  spaceId: string;
  trackId: string;
  versionId: string;
  guestToken: string | null;
};

let cachedManifest: FixtureManifest | null = null;

export function loadFixtureManifest(): FixtureManifest {
  if (cachedManifest) return cachedManifest;
  const file = path.resolve(__dirname, "fixtures.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      "test/support/fixtures.json is missing. Run: node test/support/seed-fixtures.mjs"
    );
  }
  cachedManifest = JSON.parse(fs.readFileSync(file, "utf8"));
  return cachedManifest!;
}

/** A fresh, signed-in Supabase client (anon key + real session) for a fixture role. */
export async function clientForRole(role: FixtureRole): Promise<SupabaseClient> {
  const manifest = loadFixtureManifest();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: manifest.users[role].email,
    password: manifest.password,
  });
  if (error) throw new Error(`Could not sign in as ${role}: ${error.message}`);
  return client;
}

/** An anonymous (no session) client — for asserting anon SELECT is denied. */
export function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
