// One-off, idempotent fixture seeder for TEMPO's isolated test Supabase
// project. Creates one owner account with a track, plus editor/uploader/
// commenter/viewer collaborators, an unauthorized outsider account, and a
// guest review link — covering every row of the permissions matrix in
// SECURITY-AND-PERMISSIONS.md. Run with: node test/support/seed-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PRODUCTION_REF = "bbzzaboqhvqpeoxbyiun";

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(path.join(REPO_ROOT, ".env.test.local"));
if (!env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL.includes(PRODUCTION_REF)) {
  throw new Error("Refusing to seed: not pointed at the isolated test project.");
}

// Read LEGAL_VERSION straight from lib/legal.ts so fixture users are seeded
// as having already accepted current terms (middleware otherwise redirects
// every page navigation to /legal/accept for a fresh account).
const legalSource = fs.readFileSync(path.join(REPO_ROOT, "lib", "legal.ts"), "utf8");
const legalVersionMatch = legalSource.match(/LEGAL_VERSION\s*=\s*"([^"]+)"/);
if (!legalVersionMatch) throw new Error("Could not read LEGAL_VERSION from lib/legal.ts");
const LEGAL_VERSION = legalVersionMatch[1];

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FIXTURE_PASSWORD = "Fixture-Test-2026!";
const ROLES = ["owner", "editor", "uploader", "commenter", "viewer", "unauthorized"];

async function findUserByEmail(email) {
  // supabase-js has no getUserByEmail; page through admin.listUsers.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(role) {
  const email = `${role}.fixture@tempo.test`;
  const metadata = { fixture_role: role, legal_terms_version: LEGAL_VERSION };

  const existing = await findUserByEmail(email);
  if (existing) {
    // Keep legal_terms_version current across reseed runs (e.g. after a
    // policy bump) so fixtures never get stuck behind /legal/accept.
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const users = {};
  for (const role of ROLES) {
    users[role] = await ensureUser(role);
    console.log(`user  ${role.padEnd(12)} ${users[role].id}  ${users[role].email}`);
  }

  const ownerId = users.owner.id;

  // Artist + space (owner-only)
  let { data: artist } = await admin
    .from("artists")
    .select("id")
    .eq("user_id", ownerId)
    .eq("name", "Fixture Artist")
    .maybeSingle();
  if (!artist) {
    // legacy_complete (not not_started/in_progress) so the fixture owner
    // lands straight on Today — this account exists to test the built
    // workspace, not the Origin first-run flow itself.
    ({ data: artist } = await admin
      .from("artists")
      .insert({ user_id: ownerId, name: "Fixture Artist", origin_status: "legacy_complete" })
      .select("id")
      .single());
  } else {
    await admin
      .from("artists")
      .update({ origin_status: "legacy_complete" })
      .eq("id", artist.id)
      .in("origin_status", ["not_started", "in_progress"]);
  }
  console.log(`artist               ${artist.id}`);

  let { data: space } = await admin
    .from("spaces")
    .select("id")
    .eq("artist_id", artist.id)
    .eq("name", "Fixture Space")
    .maybeSingle();
  if (!space) {
    ({ data: space } = await admin
      .from("spaces")
      .insert({ user_id: ownerId, artist_id: artist.id, name: "Fixture Space" })
      .select("id")
      .single());
  }
  console.log(`space                ${space.id}`);

  let { data: track } = await admin
    .from("tracks")
    .select("id")
    .eq("space_id", space.id)
    .eq("title", "Fixture Track")
    .maybeSingle();
  if (!track) {
    ({ data: track } = await admin
      .from("tracks")
      .insert({
        user_id: ownerId,
        space_id: space.id,
        title: "Fixture Track",
        type: "original",
      })
      .select("id")
      .single());
  }
  console.log(`track                ${track.id}`);

  let { data: version } = await admin
    .from("versions")
    .select("id")
    .eq("track_id", track.id)
    .maybeSingle();
  if (!version) {
    ({ data: version } = await admin
      .from("versions")
      .insert({
        track_id: track.id,
        file_url: "fixtures/owner-track/v1.mp3",
        is_current: true,
      })
      .select("id")
      .single());
  }
  console.log(`version              ${version.id}`);

  // Collaborators
  for (const role of ["editor", "uploader", "commenter", "viewer"]) {
    const { data: existingCollab } = await admin
      .from("track_collaborators")
      .select("id")
      .eq("track_id", track.id)
      .eq("user_id", users[role].id)
      .maybeSingle();
    if (!existingCollab) {
      await admin.from("track_collaborators").insert({
        track_id: track.id,
        user_id: users[role].id,
        role,
        status: "active",
        invited_by: ownerId,
        accepted_at: new Date().toISOString(),
      });
    }
    console.log(`collaborator  ${role.padEnd(12)} ${users[role].id}`);
  }

  // Guest review link
  const { data: existingGuestLink } = await admin
    .from("guest_review_links")
    .select("id")
    .eq("track_id", track.id)
    .maybeSingle();

  let guestToken = null;
  if (!existingGuestLink) {
    guestToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(guestToken).digest("hex");
    await admin.from("guest_review_links").insert({
      track_id: track.id,
      version_id: version.id,
      created_by: ownerId,
      token_hash: tokenHash,
      allow_comments: true,
      allow_download: false,
    });
    console.log(`guest link           token minted (see fixtures.json)`);
  } else {
    console.log(`guest link           already exists (raw token not recoverable; delete row to remint)`);
  }

  const manifest = {
    password: FIXTURE_PASSWORD,
    users: Object.fromEntries(ROLES.map((r) => [r, { id: users[r].id, email: users[r].email }])),
    artistId: artist.id,
    spaceId: space.id,
    trackId: track.id,
    versionId: version.id,
    guestToken, // null if this run didn't (re)mint one
  };
  fs.writeFileSync(
    path.join(__dirname, "fixtures.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log("\nWrote test/support/fixtures.json");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
