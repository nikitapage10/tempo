import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type StarterProfile = {
  id: string;
  owner_user_id: string;
  handle: string | null;
  display_name: string;
  emblem_url: string | null;
  bio: string | null;
  location: string | null;
  country_code: string | null;
  links: unknown;
  visibility: "private" | "members" | "public";
  published_at: string | null;
};

const starterProfileFields =
  "id, owner_user_id, handle, display_name, emblem_url, bio, location, country_code, links, visibility, published_at";

function missingDemoKind(error: { code?: string; message?: string } | null) {
  return !!error && (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("demo_kind") === true
  );
}

/**
 * The demo profile is a visual sandbox, never the member's social identity.
 * Resolve through artists.demo_kind before choosing the profile so opening a
 * demo early cannot make PRESIDENT follow an inviter or join the Green Room.
 */
async function memberProfileForProvisioning(
  service: AdminClient,
  userId: string
): Promise<StarterProfile | null> {
  const { data: artists, error: artistError } = await service
    .from("artists")
    .select("id")
    .eq("user_id", userId)
    .is("demo_kind", null)
    .order("sort", { ascending: true });

  if (artistError && !missingDemoKind(artistError)) throw artistError;
  if (!artistError) {
    const artistIds = (artists ?? []).map((artist) => artist.id);
    if (!artistIds.length) return null;
    const { data, error } = await service
      .from("artist_profiles")
      .select(starterProfileFields)
      .eq("owner_user_id", userId)
      .in("artist_id", artistIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as StarterProfile | null) ?? null;
  }

  // Pre-073 databases have no demo feature, so every profile is real.
  const { data, error } = await service
    .from("artist_profiles")
    .select(starterProfileFields)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as StarterProfile | null) ?? null;
}

export async function hasRealArtistProfile(service: AdminClient, userId: string) {
  return !!(await memberProfileForProvisioning(service, userId));
}

export async function isRealArtistOnNetwork(service: AdminClient, userId: string) {
  const profile = await memberProfileForProvisioning(service, userId);
  return profile?.visibility === "members" || profile?.visibility === "public";
}

const LEGACY_SOCIAL_STARTERS = [
  "Welcome to TEMPO. Share what you are making, what you are figuring out, or the next step you want to take.",
  "What is moving in your studio this week? A rough idea counts just as much as a finished release.",
  "Use this feed like an open studio door. Ask for ears, share a small win, or leave a note about the process.",
] as const;

const SCENE_STARTERS = [
  "Welcome to the Green Room. Introduce yourself and tell us what kind of music you are working on.",
  "A good place to begin: share one thing you want to finish this month and one thing you want feedback on.",
] as const;

const CHAT_STARTERS = [
  "Welcome in! This room is here so you can see how a Scene conversation feels.",
  "Say hello whenever you are ready, or share the song that has been living in your head lately.",
] as const;

function missingRelation(error: { code?: string; message?: string } | null, name: string) {
  if (!error) return false;
  return error.code === "42P01" || error.message?.includes(`'${name}'`) || error.message?.includes(`\"${name}\"`);
}

function configuredHandles() {
  return (process.env.ONBOARDING_DEMO_PROFILE_HANDLES ?? "")
    .split(",")
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
}

function oneProfilePerAccount(profiles: StarterProfile[]) {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.owner_user_id)) return false;
    seen.add(profile.owner_user_id);
    return true;
  });
}

async function removeLegacyStarterFollows(
  service: AdminClient,
  memberProfileId: string
) {
  const { data: posts, error: postError } = await service
    .from("posts")
    .select("author_profile_id")
    .in("body", [...LEGACY_SOCIAL_STARTERS])
    .is("scene_id", null);
  if (postError) throw postError;
  const followeeIds = Array.from(new Set(
    (posts ?? []).map((post) => post.author_profile_id).filter(Boolean)
  ));
  if (!followeeIds.length) return;
  const { error } = await service
    .from("profile_follows")
    .delete()
    .eq("follower_profile_id", memberProfileId)
    .in("followee_profile_id", followeeIds);
  if (error) throw error;
}

async function starterProfiles(
  service: AdminClient,
  userId: string,
  inviteId: string | null
): Promise<StarterProfile[]> {
  const handles = configuredHandles();
  const preferredUserIds = new Set<string>();

  if (inviteId) {
    const { data: invite } = await service
      .from("invites")
      .select("created_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (invite?.created_by && invite.created_by !== userId) preferredUserIds.add(invite.created_by);
  }

  const [{ data: team }, { data: admins }] = await Promise.all([
    service
      .from("member_onboarding")
      .select("user_id")
      .in("member_role", ["team_member", "administrator"])
      .neq("user_id", userId)
      .limit(12),
    service.from("platform_admins").select("user_id").neq("user_id", userId).limit(12),
  ]);
  for (const row of team ?? []) preferredUserIds.add(row.user_id);
  for (const row of admins ?? []) preferredUserIds.add(row.user_id);

  const byId = new Map<string, StarterProfile>();
  if (handles.length) {
    const { data } = await service
      .from("artist_profiles")
      .select(starterProfileFields)
      .in("handle", handles)
      .neq("owner_user_id", userId);
    for (const profile of data ?? []) byId.set(profile.id, profile as StarterProfile);
  }
  if (preferredUserIds.size) {
    const { data } = await service
      .from("artist_profiles")
      .select(starterProfileFields)
      .in("owner_user_id", Array.from(preferredUserIds))
      .neq("owner_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(12);
    for (const profile of data ?? []) byId.set(profile.id, profile as StarterProfile);
  }

  // Round out the preview with already-published artists when the inviter or
  // team only supplies one identity. This keeps the sample representative
  // without changing an unrelated member's privacy setting.
  if (byId.size < 3) {
    const { data } = await service
      .from("artist_profiles")
      .select(starterProfileFields)
      .in("visibility", ["members", "public"])
      .neq("owner_user_id", userId)
      .order("published_at", { ascending: false })
      .limit(12);
    for (const profile of data ?? []) byId.set(profile.id, profile as StarterProfile);
  }

  // An explicitly configured demo identity, the inviter, and TEMPO team
  // accounts are meant to welcome new members. Make those identities visible
  // inside TEMPO even if their profile was left on its default private state.
  const preferredProfiles = Array.from(byId.values()).filter(
    (profile) =>
      profile.visibility === "private" &&
      (handles.includes(profile.handle ?? "") || preferredUserIds.has(profile.owner_user_id))
  );
  if (preferredProfiles.length) {
    const publishedAt = new Date().toISOString();
    const ids = preferredProfiles.map((profile) => profile.id);
    const { error } = await service
      .from("artist_profiles")
      .update({ visibility: "members", published_at: publishedAt })
      .in("id", ids);
    if (error) throw error;
    for (const profile of preferredProfiles) {
      profile.visibility = "members";
      profile.published_at = publishedAt;
    }
  }

  const handleRank = new Map(handles.map((handle, index) => [handle, index]));
  return Array.from(byId.values())
    .sort((a, b) => {
      const aRank = a.handle ? handleRank.get(a.handle) : undefined;
      const bRank = b.handle ? handleRank.get(b.handle) : undefined;
      if (aRank !== undefined || bRank !== undefined) return (aRank ?? 99) - (bRank ?? 99);
      return Number(preferredUserIds.has(b.owner_user_id)) - Number(preferredUserIds.has(a.owner_user_id));
    })
    .slice(0, 3);
}

async function ensureStarterScene(service: AdminClient, owner: StarterProfile) {
  const slug = (process.env.ONBOARDING_DEMO_SCENE_SLUG ?? "tempo-green-room")
    .trim()
    .toLowerCase();
  const { data: existing } = await service
    .from("scenes")
    .select("id, slug, name")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await service
    .from("scenes")
    .insert({
      slug,
      name: "The Green Room",
      tagline: "A friendly first room for artists finding their way around TEMPO.",
      about: "Meet a few artists, see how Scene conversations work, and share whatever is taking shape in your studio.",
      kind: "collective",
      owner_profile_id: owner.id,
      owner_user_id: owner.owner_user_id,
      join_policy: "open",
      visibility: "members",
      genres: [],
      links: [],
      features: { feed: true, chat: true, events: true },
      welcome_checklist: [
        { id: "introduce", label: "Introduce yourself in the feed" },
        { id: "say-hello", label: "Say hello in chat" },
      ],
    })
    .select("id, slug, name")
    .single();
  if (!error && data) return data;

  // Another first-run request may have created the shared room concurrently.
  const { data: raced, error: racedError } = await service
    .from("scenes")
    .select("id, slug, name")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (racedError || !raced) throw error ?? racedError ?? new Error("Starter Scene could not be created");
  return raced;
}

async function addMemberToScene(
  service: AdminClient,
  sceneId: string,
  userId: string,
  profile: StarterProfile
) {
  const { data: membership } = await service
    .from("scene_members")
    .select("status")
    .eq("scene_id", sceneId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership?.status === "active" || membership?.status === "banned") return;

  const { data: existingPersona, error: personaReadError } = await service
    .from("scene_personas")
    .select("id")
    .eq("scene_id", sceneId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!personaReadError || existingPersona) {
    let personaId = existingPersona?.id ?? null;
    if (!personaId) {
      const safeHandle = profile.handle && /^[a-z0-9_]{2,30}$/.test(profile.handle)
        ? profile.handle
        : null;
      const { data: persona, error } = await service
        .from("scene_personas")
        .upsert({
          scene_id: sceneId,
          user_id: userId,
          artist_profile_id: profile.id,
          display_name: profile.display_name,
          handle: safeHandle,
          avatar_url: profile.emblem_url,
          bio: profile.bio,
          location: profile.location,
          country_code: profile.country_code,
          links: profile.links ?? [],
          source: "artist",
        }, { onConflict: "scene_id,user_id" })
        .select("id")
        .single();
      if (error || !persona) throw error ?? new Error("Starter Scene persona could not be created");
      personaId = persona.id;
    }
    const membershipRow = {
      scene_id: sceneId,
      persona_id: personaId,
      profile_id: profile.id,
      user_id: userId,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    };
    // Some deployments can be paused midway through migration 060, before the
    // account-level unique index exists. Update-then-insert works on both the
    // legacy profile key and the final account key without relying on either
    // ON CONFLICT specification.
    const { data: updated, error: updateError } = await service
      .from("scene_members")
      .update(membershipRow)
      .eq("scene_id", sceneId)
      .eq("user_id", userId)
      .select("user_id");
    if (updateError) throw updateError;
    if (!updated?.length) {
      const { error } = await service.from("scene_members").insert(membershipRow);
      if (error) throw error;
    }
    return;
  }

  if (!missingRelation(personaReadError, "scene_personas")) throw personaReadError;
  const { error } = await service.from("scene_members").upsert({
    scene_id: sceneId,
    profile_id: profile.id,
    user_id: userId,
    role: "member",
    status: "active",
    joined_at: new Date().toISOString(),
  }, { onConflict: "scene_id,profile_id" });
  if (error) throw error;
}

async function seedSceneContent(
  service: AdminClient,
  scene: { id: string; name: string },
  profiles: StarterProfile[]
) {
  const sceneProfiles = profiles.slice(0, 2);
  for (let index = 0; index < sceneProfiles.length; index += 1) {
    const profile = sceneProfiles[index];
    const body = SCENE_STARTERS[index];
    const { data: existing, error: existingError } = await service
      .from("posts")
      .select("id")
      .eq("scene_id", scene.id)
      .eq("body", body)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      const { error } = await service.from("posts").insert({
        author_profile_id: profile.id,
        author_user_id: profile.owner_user_id,
        body,
        media: [],
        visibility: "members",
        scene_id: scene.id,
        kind: "post",
      });
      if (error) throw error;
    }
  }

  let { data: conversation } = await service
    .from("conversations")
    .select("id")
    .eq("scene_id", scene.id)
    .is("scene_topic_id", null)
    .maybeSingle();
  if (!conversation) {
    const owner = profiles[0];
    const { data, error } = await service.from("conversations").insert({
      kind: "group",
      title: scene.name,
      created_by_profile_id: owner.id,
      scene_id: scene.id,
    }).select("id").single();
    if (error || !data) throw error ?? new Error("Starter Scene chat could not be created");
    conversation = data;
  }

  const chatProfiles = profiles.slice(0, 2);
  for (let index = 0; index < chatProfiles.length; index += 1) {
    const profile = chatProfiles[index];
    const body = CHAT_STARTERS[index];
    const { data: existing, error: existingError } = await service
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("body", body)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      const { error } = await service.from("messages").insert({
        conversation_id: conversation.id,
        sender_profile_id: profile.id,
        sender_user_id: profile.owner_user_id,
        body,
        suppress_notification: true,
      });
      if (error) throw error;
    }
  }
}

/**
 * Gives first-run accounts a small, real community to explore.
 * Every write is naturally idempotent so the onboarding endpoint can retry
 * after the artist profile appears without duplicating starter content.
 *
 * Returns true only when it ran all the way through. It bails out early and
 * returns false while the account is still too new to seed against (no
 * onboarding row yet, or no artist profile yet) — the caller uses that to
 * decide whether the work is finished for good, so returning true when a step
 * was skipped would strand the account without its starter community.
 */
export async function provisionStarterCommunity(
  service: AdminClient,
  userId: string
): Promise<boolean> {
  const { data: onboarding, error: onboardingError } = await service
    .from("member_onboarding")
    .select("invite_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (onboardingError || !onboarding) return false;

  const memberProfile = await memberProfileForProvisioning(service, userId);
  if (!memberProfile) return false;

  // Accounts created while the old private-preview experiment was active may
  // already follow profiles that were selected solely to populate that mock
  // feed. Remove only those exact synthetic connections before joining.
  await removeLegacyStarterFollows(service, memberProfile.id);

  const profiles = await starterProfiles(service, userId, onboarding.invite_id);
  const sceneProfiles = oneProfilePerAccount(profiles);
  const sceneOwner = sceneProfiles[0] ?? (memberProfile as StarterProfile);
  const scene = await ensureStarterScene(service, sceneOwner);
  for (const profile of sceneProfiles) {
    await addMemberToScene(service, scene.id, profile.owner_user_id, profile);
  }
  await addMemberToScene(service, scene.id, userId, memberProfile as StarterProfile);
  await seedSceneContent(service, scene, sceneProfiles.length ? sceneProfiles : [memberProfile as StarterProfile]);
  return true;
}
