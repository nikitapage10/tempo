/**
 * One-off seed: funny vocalist / co-producer test artists for Social UI.
 * Creates auth users, artists, published profiles, uploads emblems, then
 * links them into the first real owner's people + follow graph.
 *
 * Run: node scripts/seed-social-cast.js
 * Not part of the app release — local/dev convenience only.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "audio";
const PASS = "TempoCast!23456";

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ASSETS = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-nikit-Documents-TEMPO",
  "assets"
);

const CAST = [
  {
    slug: "velvetstatic",
    email: "velvet.static@tempo.test",
    name: "Velvet Static",
    handle: "velvetstatic",
    roles: ["vocalist", "topliner"],
    genres: ["R&B", "Alt-pop"],
    tagline: "Bathroom reverb or bust.",
    bio: "I only cut vocals in tiled rooms. If your booth doesn't echo like a spa, I'm not feeling it. Available for hooks, ad-libs, and emotionally devastating 'yeah's.",
    backstory:
      "Started as a session singer who accidentally recorded a global hit on Voice Memos while brushing her teeth. Now she charges extra for 'natural reverb consultations' and refuses dry rooms on principle.",
    emblem: "emblem-velvet-static.png",
    ice: "#F5A8C8",
    amber: "#A8C4FF",
    location: "Los Angeles, CA, USA",
    countryCode: "us",
    source: "collaborator",
    personRole: "vocalist",
  },
  {
    slug: "softlaunch",
    email: "dj.softlaunch@tempo.test",
    name: "DJ Soft Launch",
    handle: "softlaunch",
    roles: ["co-producer", "beatmaker"],
    genres: ["Hyperpop", "Dance"],
    tagline: "Everything soft-launches. Including me.",
    bio: "I never drop a beat — I leak it to three group chats first. If the vibe survives the soft launch, we master. If not, it was 'never real.'",
    backstory:
      "Former brand strategist who pivoted to production after soft-launching a sandwich on Instagram and getting 40k saves. Treats every arrangement like a product rollout.",
    emblem: "emblem-soft-launch.png",
    ice: "#5CE1FF",
    amber: "#FF5CC8",
    location: "New York, NY, USA",
    countryCode: "us",
    source: "collaborator",
    personRole: "co-producer",
  },
  {
    slug: "harmonylawsuit",
    email: "harmony.lawsuit@tempo.test",
    name: "Harmony Lawsuit",
    handle: "harmonylawsuit",
    roles: ["vocalist", "harmony arranger"],
    genres: ["Pop", "Gospel-pop"],
    tagline: "My thirds are legally distinct.",
    bio: "Stack specialist. Will argue with your DAW about voice leading. Once almost got a C&D for a background 'ooh' that sounded too famous. Still uses it.",
    backstory:
      "Grew up in a choir where every wrong note was a federal case. Channelled that energy into session work and a slightly litigious approach to stacked vocals.",
    emblem: "emblem-harmony-lawsuit.png",
    ice: "#C4B0FF",
    amber: "#E8C46A",
    location: "Nashville, TN, USA",
    countryCode: "us",
    source: "release_credit",
    personRole: "featured_artist",
  },
  {
    slug: "basslinebarry",
    email: "bassline.barry@tempo.test",
    name: "Bassline Barry",
    handle: "basslinebarry",
    roles: ["co-producer", "bassist"],
    genres: ["UKG", "Afro-house"],
    tagline: "If it doesn't move the couch, delete it.",
    bio: "Low-end maximalist. I write basslines that file noise complaints against themselves. Keys must feel expensive or I'm out.",
    backstory:
      "Bought a subwoofer before he bought a bed. Neighbors know his release calendar better than he does. Co-produces from a basement that has its own ZIP code in the low frequencies.",
    emblem: "emblem-bassline-barry.png",
    ice: "#3D7EFF",
    amber: "#FF8A3D",
    location: "London, UK",
    countryCode: "gb",
    source: "collaborator",
    personRole: "co-producer",
  },
  {
    slug: "choruscrisis",
    email: "chorus.crisis@tempo.test",
    name: "Chorus Crisis",
    handle: "choruscrisis",
    roles: ["vocalist"],
    genres: ["Indie", "Electropop"],
    tagline: "Three takes of 'yeah.' All different crises.",
    bio: "I don't do verses — I do emotional emergencies that happen to be catchy. Bring snacks and an opinion about the pre-chorus.",
    backstory:
      "Famous for turning mild studio disagreements into charting choruses. Keeps a spreadsheet of which 'yeah' takes were recorded during which personal spiral.",
    emblem: "emblem-chorus-crisis.png",
    ice: "#FF8A8A",
    amber: "#FF6B6B",
    location: "Berlin, Germany",
    countryCode: "de",
    source: "guest_review",
    personRole: "guest_reviewer",
  },
  {
    slug: "pluginpriest",
    email: "plugin.priest@tempo.test",
    name: "Plugin Priest",
    handle: "pluginpriest",
    roles: ["co-producer", "mix assistant"],
    genres: ["Experimental", "Electronic"],
    tagline: "Blessed be thy free trial.",
    bio: "I anoint sessions with unfinished plugins and ancient presets. If your mix isn't spiritually confusing, we haven't started.",
    backstory:
      "Left seminary after discovering convolution reverb. Now performs 'patch blessings' before print masters and refuses to delete demo folders 'out of respect for the ghosts.'",
    emblem: "emblem-plugin-priest.png",
    ice: "#9D8CFF",
    amber: "#FFB56B",
    location: "Amsterdam, Netherlands",
    countryCode: "nl",
    source: "collaborator",
    personRole: "co-producer",
  },
  {
    slug: "autotuneauntie",
    email: "autotune.auntie@tempo.test",
    name: "Autotune Auntie",
    handle: "autotuneauntie",
    roles: ["vocalist", "vocal producer"],
    genres: ["Pop", "Afrobeats"],
    tagline: "I'll pitch-correct your life advice too.",
    bio: "Warm, ruthless, in tune. I fix your doubles and your decisions. Retune is love language.",
    backstory:
      "Everyone's cool aunt who also owns every version of pitch correction ever shipped. Will feed you and then ask why bar 32 is flat emotionally and sonically.",
    emblem: "emblem-autotune-auntie.png",
    ice: "#3DCFC0",
    amber: "#FFB89A",
    location: "Lagos, Nigeria",
    countryCode: "ng",
    source: "collaborator",
    personRole: "vocalist",
  },
];

async function svcInsert(table, row) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} insert ${res.status}: ${text}`);
  const data = JSON.parse(text);
  return Array.isArray(data) ? data[0] : data;
}

async function svcUpsert(table, row, onConflict) {
  const res = await fetch(`${URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${text}`);
  const data = JSON.parse(text);
  return Array.isArray(data) ? data[0] : data;
}

async function uploadEmblem(artistId, filename) {
  const filePath = path.join(ASSETS, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Missing emblem ${filePath}`);
  const buf = fs.readFileSync(filePath);
  // Versioned path so browsers don't keep serving a cached older emblem.
  const storagePath = `artists/${artistId}/emblem/v2-${filename}`;
  const { error } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: "image/png",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return storagePath;
}

async function findOrCreateUser(email) {
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = (listed.data.users || []).find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASS,
      email_confirm: true,
    });
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const { data: ownerProfiles, error: ownerErr } = await admin
    .from("artist_profiles")
    .select("id, owner_user_id, display_name, handle")
    .order("created_at", { ascending: true })
    .limit(5);
  if (ownerErr) throw ownerErr;

  // Prefer the real artist (not leftover test accounts)
  const ownerProfile =
    (ownerProfiles || []).find(
      (p) => p.handle === "nikitapage" || /nikita/i.test(p.display_name || "")
    ) || (ownerProfiles || [])[0];
  if (!ownerProfile) throw new Error("No owner artist_profiles row found");
  console.log(
    "Linking cast to owner profile",
    ownerProfile.display_name,
    ownerProfile.handle
  );

  const results = [];

  for (const cast of CAST) {
    console.log("\n==", cast.name, "==");
    const user = await findOrCreateUser(cast.email);

    // Artist row (one per cast user)
    let artist;
    {
      const { data: existing } = await admin
        .from("artists")
        .select("*")
        .eq("user_id", user.id)
        .order("sort", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing) {
        artist = existing;
        const { data: updated, error } = await admin
          .from("artists")
          .update({
            name: cast.name,
            ice_color: cast.ice,
            amber_color: cast.amber,
            palette_id: "custom",
          })
          .eq("id", artist.id)
          .select("*")
          .single();
        if (error) throw error;
        artist = updated;
      } else {
        artist = await svcInsert("artists", {
          user_id: user.id,
          name: cast.name,
          sort: 0,
          palette_id: "custom",
          ice_color: cast.ice,
          amber_color: cast.amber,
        });
      }
    }

    const emblemPath = await uploadEmblem(artist.id, cast.emblem);
    {
      const { data: updated, error } = await admin
        .from("artists")
        .update({ emblem_url: emblemPath })
        .eq("id", artist.id)
        .select("*")
        .single();
      if (error) throw error;
      artist = updated;
    }

    // Ensure a default space exists (app expects spaces)
    {
      const { data: spaces } = await admin
        .from("spaces")
        .select("id")
        .eq("artist_id", artist.id)
        .limit(1);
      if (!spaces?.length) {
        await svcInsert("spaces", {
          user_id: user.id,
          artist_id: artist.id,
          name: "Originals",
          sort: 0,
          focus: "music",
        });
      }
    }

    let profile;
    {
      const { data: existing } = await admin
        .from("artist_profiles")
        .select("*")
        .eq("artist_id", artist.id)
        .maybeSingle();
      const payload = {
        artist_id: artist.id,
        owner_user_id: user.id,
        display_name: cast.name,
        handle: cast.handle,
        emblem_url: emblemPath,
        ice_color: cast.ice,
        amber_color: cast.amber,
        palette_id: "custom",
        tagline: cast.tagline,
        bio: cast.bio,
        backstory: cast.backstory,
        roles: cast.roles,
        genres: cast.genres,
        location: cast.location,
        country_code: cast.countryCode,
        visibility: "members",
        published_at: new Date().toISOString(),
        accepts_dms: "anyone",
        pronouns: null,
        links: [
          { label: "Somewhere on the internet", url: "https://tempo-ten-sigma.vercel.app" },
        ],
      };
      if (existing) {
        const { data, error } = await admin
          .from("artist_profiles")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        profile = data;
      } else {
        profile = await svcInsert("artist_profiles", payload);
      }
    }

    // People CRM row for the owner
    let person;
    {
      const { data: existing } = await admin
        .from("people")
        .select("*")
        .eq("user_id", ownerProfile.owner_user_id)
        .eq("linked_profile_id", profile.id)
        .maybeSingle();
      if (existing) {
        const { data, error } = await admin
          .from("people")
          .update({
            display_name: cast.name,
            linked_user_id: user.id,
            roles: [cast.personRole],
            source: cast.source,
            notes: cast.tagline,
            is_archived: false,
            last_interaction_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        person = data;
      } else {
        person = await svcInsert("people", {
          user_id: ownerProfile.owner_user_id,
          display_name: cast.name,
          linked_profile_id: profile.id,
          linked_user_id: user.id,
          roles: [cast.personRole],
          source: cast.source,
          notes: cast.tagline,
          last_interaction_at: new Date().toISOString(),
        });
      }
    }

    // Owner follows cast (so Discover + feed can light up)
    await admin.from("profile_follows").upsert(
      {
        follower_profile_id: ownerProfile.id,
        followee_profile_id: profile.id,
      },
      { onConflict: "follower_profile_id,followee_profile_id" }
    );
    // A few follow back for mutual / DM-friendly
    if (["velvetstatic", "softlaunch", "pluginpriest", "autotuneauntie"].includes(cast.slug)) {
      await admin.from("profile_follows").upsert(
        {
          follower_profile_id: profile.id,
          followee_profile_id: ownerProfile.id,
        },
        { onConflict: "follower_profile_id,followee_profile_id" }
      );
    }

    // Seed a short members-visible post so the feed isn't empty
    {
      const { data: existingPosts } = await admin
        .from("posts")
        .select("id")
        .eq("author_profile_id", profile.id)
        .is("deleted_at", null)
        .limit(1);
      if (!existingPosts?.length) {
        await svcInsert("posts", {
          author_profile_id: profile.id,
          author_user_id: user.id,
          body: `${cast.tagline} — in the booth if you need me. @${ownerProfile.handle || "nikitapage"}`,
          visibility: "members",
          media: [],
        });
      }
    }

    results.push({
      name: cast.name,
      handle: cast.handle,
      email: cast.email,
      password: PASS,
      profileId: profile.id,
      personId: person.id,
    });
    console.log("ready @" + cast.handle);
  }

  const out = path.join(__dirname, "_social_cast.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("\nWrote", out);
  console.log("All passwords:", PASS);
  console.log("Open Social → Network / Discover / orbit to see them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
