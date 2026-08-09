import { createClient } from "@/lib/supabase/client";
import { buildSceneMediaPath, deleteFile, uploadFile } from "@/lib/storage";
import type { Scene, SceneKind, SceneJoinPolicy, SceneVisibility, SceneMemberStatus } from "@/lib/types";

/**
 * True when some part of the Scenes migration set (049–054) hasn't been run
 * yet. Matches any "scene…" identifier — table, column (e.g. the
 * conversations.scene_id column 053 adds), or function — rather than an
 * explicit list, since a narrower pattern silently stops catching new
 * migrations' errors as they're added.
 */
export function isMissingSceneSchema(error: { message?: string }): boolean {
  return /\bscene/i.test(error?.message ?? "");
}

/**
 * A cheap, dedicated check so callers can tell "migration 049 hasn't run" —
 * which needs its own explanatory empty state — apart from "there are
 * genuinely no scenes yet", which the list-fetchers below can't distinguish
 * on their own once they swallow the missing-table error into `[]`.
 */
export async function checkScenesSchemaReady(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("scenes").select("id").limit(1);
  if (error) {
    if (isMissingSceneSchema(error)) return false;
    throw error;
  }
  return true;
}

type CallerMembership = {
  scene_id: string;
  role: Scene["my_role"];
  status: SceneMemberStatus;
  last_read_at: string | null;
};

/**
 * Every scene_members row the signed-in user holds, across however many
 * artist profiles they release under. RLS already scopes select_scene_members
 * to rows the caller may see; filtering by user_id here keeps the query
 * cheap and excludes other members' rows on scenes they manage.
 */
async function fetchCallerMemberships(): Promise<CallerMembership[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("scene_members")
    .select("scene_id, role, status, last_read_at")
    .eq("user_id", user.id);
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as CallerMembership[];
}

function withCallerState(scene: Scene, membership: CallerMembership | undefined): Scene {
  return {
    ...scene,
    my_role: membership?.role ?? null,
    my_status: membership?.status ?? null,
    has_unread: membership?.status === "active"
      ? !membership.last_read_at || membership.last_read_at < scene.last_activity_at
      : false,
  };
}

/**
 * Scenes the caller is active or pending in, sorted by activity. A pending
 * request stays visible here (status carries "waiting on approval") rather
 * than vanishing into a separate queue only the scene's own managers can see.
 */
export async function fetchMyScenes(): Promise<Scene[]> {
  const memberships = await fetchCallerMemberships();
  const relevant = memberships.filter((m) => m.status === "active" || m.status === "pending");
  if (relevant.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .in("id", relevant.map((m) => m.scene_id))
    .is("archived_at", null)
    .order("last_activity_at", { ascending: false });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  const byScene = new Map(relevant.map((m) => [m.scene_id, m]));
  return ((data ?? []) as Scene[]).map((s) => withCallerState(s, byScene.get(s.id)));
}

/** Scenes the caller has an outstanding invite to. */
export async function fetchMyInvites(): Promise<Scene[]> {
  const memberships = await fetchCallerMemberships();
  const invited = memberships.filter((m) => m.status === "invited");
  if (invited.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .in("id", invited.map((m) => m.scene_id))
    .is("archived_at", null);
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  const byScene = new Map(invited.map((m) => [m.scene_id, m]));
  return ((data ?? []) as Scene[]).map((s) => withCallerState(s, byScene.get(s.id)));
}

/**
 * Browsable scenes the caller hasn't joined. Before a search term, the most
 * recently active ones — a place to land, not an empty search box.
 */
export async function fetchDiscoverScenes(
  query: string,
  opts: { excludeSceneIds?: string[]; limit?: number } = {}
): Promise<Scene[]> {
  const supabase = createClient();
  const term = query.trim().replace(/[%,()]/g, " ").trim();

  let request = supabase
    .from("scenes")
    .select("*")
    .in("visibility", ["members", "public"])
    .is("archived_at", null);

  if (opts.excludeSceneIds?.length) {
    request = request.not("id", "in", `(${opts.excludeSceneIds.join(",")})`);
  }
  if (term.length >= 2) {
    request = request.or(`name.ilike.%${term}%,tagline.ilike.%${term}%`);
  }

  const { data, error } = await request
    .order("last_activity_at", { ascending: false })
    .limit(opts.limit ?? 24);
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as Scene[];
}

export async function fetchSceneBySlug(slug: string): Promise<Scene | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) {
    if (isMissingSceneSchema(error)) return null;
    throw error;
  }
  if (!data) return null;

  const memberships = await fetchCallerMemberships();
  const mine = memberships.find((m) => m.scene_id === (data as Scene).id);
  return withCallerState(data as Scene, mine);
}

/**
 * True when the slug is free. Case-insensitive; the shape check happens
 * server-side. An archived scene's slug doesn't count as taken — migration
 * 058 makes the same exception at the database level.
 */
export async function isSceneSlugAvailable(slug: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("id")
    .eq("slug", slug.toLowerCase())
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    if (isMissingSceneSchema(error)) return true;
    throw error;
  }
  return !data;
}

export type CreateSceneInput = {
  slug: string;
  name: string;
  kind: SceneKind;
  tagline?: string | null;
  about?: string | null;
  joinPolicy: SceneJoinPolicy;
  visibility: SceneVisibility;
  ownerProfileId?: string | null;
};

/**
 * One insert. The 049 seed trigger creates the owner's membership and a
 * default "General" topic in the same transaction, so the client never has
 * to make three writes that could half-fail.
 */
export async function createScene(input: CreateSceneInput): Promise<Scene> {
  const supabase = createClient();
  // Send owner_user_id explicitly rather than leaning on the column's
  // `default auth.uid()`. insert_scenes checks `owner_user_id = auth.uid()`,
  // and if that default ever resolves to NULL the comparison is NULL — not
  // true — so the policy rejects the row with a bare 42501 and no hint.
  // Every other write path in the app already passes the id explicitly.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You’re signed out — sign in again, then retry.");

  const { data, error } = await supabase
    .from("scenes")
    .insert({
      slug: input.slug.toLowerCase(),
      name: input.name.trim(),
      kind: input.kind,
      tagline: input.tagline?.trim() || null,
      about: input.about?.trim() || null,
      join_policy: input.joinPolicy,
      visibility: input.visibility,
      owner_profile_id: input.ownerProfileId ?? null,
      owner_user_id: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  // seed_new_scene() adds the owner's membership in an AFTER INSERT trigger
  // chained off this row's own insert, so it runs after the RETURNING
  // snapshot is already fixed — the row we get back still shows
  // member_count: 0. Floor it at 1 so the creator doesn't see "0 members"
  // on the scene they're standing in.
  const created = data as Scene;
  return withCallerState(
    { ...created, member_count: Math.max(created.member_count, 1) },
    {
      scene_id: created.id,
      role: "owner",
      status: "active",
      last_read_at: null,
    }
  );
}

export async function seedOwlsNestDemo(): Promise<Scene> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_owls_nest_demo");
  if (error) throw error;
  return data as Scene;
}

export type UpdateSceneInput = Partial<{
  name: string;
  kind: SceneKind;
  tagline: string | null;
  about: string | null;
  joinPolicy: SceneJoinPolicy;
  visibility: SceneVisibility;
  paletteId: Scene["palette_id"];
  iceColor: string | null;
  amberColor: string | null;
  bannerFocalX: number;
  bannerFocalY: number;
  bannerAlt: string | null;
  bannerTreatment: NonNullable<Scene["banner_treatment"]>;
  publicSummary: string | null;
  rules: string | null;
  timezone: string | null;
}>;

/** Owner-only edit of a scene's identity, door, and palette (update_scenes RLS). */
export async function updateScene(scene: Scene, input: UpdateSceneInput): Promise<Scene> {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.tagline !== undefined) patch.tagline = input.tagline?.trim() || null;
  if (input.about !== undefined) patch.about = input.about?.trim() || null;
  if (input.joinPolicy !== undefined) patch.join_policy = input.joinPolicy;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.paletteId !== undefined) patch.palette_id = input.paletteId;
  if (input.iceColor !== undefined) patch.ice_color = input.iceColor;
  if (input.amberColor !== undefined) patch.amber_color = input.amberColor;
  if (input.bannerFocalX !== undefined) patch.banner_focal_x = input.bannerFocalX;
  if (input.bannerFocalY !== undefined) patch.banner_focal_y = input.bannerFocalY;
  if (input.bannerAlt !== undefined) patch.banner_alt = input.bannerAlt?.trim() || null;
  if (input.bannerTreatment !== undefined) patch.banner_treatment = input.bannerTreatment;
  if (input.publicSummary !== undefined) patch.public_summary = input.publicSummary?.trim() || null;
  if (input.rules !== undefined) patch.rules = input.rules?.trim() || null;
  if (input.timezone !== undefined) patch.timezone = input.timezone?.trim() || null;

  const { data, error } = await supabase
    .from("scenes")
    .update(patch)
    .eq("id", scene.id)
    .select("*")
    .single();
  if (error) throw error;
  return withCallerState(data as Scene, {
    scene_id: scene.id,
    role: scene.my_role ?? null,
    status: scene.my_status ?? "active",
    last_read_at: null,
  });
}

/**
 * Owner-only. Scenes are archived, never hard-deleted (SCENES-SPEC.md §1) —
 * an archived scene drops out of browse/discover and stops accepting new
 * posts or joins, but existing members' history stays intact.
 */
export async function archiveScene(sceneId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scenes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", sceneId);
  if (error) throw error;
}

export async function uploadSceneBanner(scene: Scene, file: File): Promise<Scene> {
  const path = buildSceneMediaPath({
    sceneId: scene.id,
    kind: "banner",
    entityId: scene.id,
    filename: file.name,
  });
  await uploadFile(path, file);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .update({ banner_url: path, banner_color: null, banner_color_end: null })
    .eq("id", scene.id)
    .select("*")
    .single();
  if (error) throw error;
  if (scene.banner_url && scene.banner_url !== path) {
    void deleteFile(scene.banner_url).catch(() => {});
  }
  return withCallerState(data as Scene, {
    scene_id: scene.id,
    role: scene.my_role ?? null,
    status: scene.my_status ?? "active",
    last_read_at: null,
  });
}

export async function uploadSceneEmblem(scene: Scene, file: File): Promise<Scene> {
  const path = buildSceneMediaPath({
    sceneId: scene.id,
    kind: "emblem",
    entityId: scene.id,
    filename: file.name,
  });
  await uploadFile(path, file);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scenes")
    .update({ emblem_url: path })
    .eq("id", scene.id)
    .select("*")
    .single();
  if (error) throw error;
  if (scene.emblem_url && scene.emblem_url !== path) {
    void deleteFile(scene.emblem_url).catch(() => {});
  }
  return withCallerState(data as Scene, {
    scene_id: scene.id,
    role: scene.my_role ?? null,
    status: scene.my_status ?? "active",
    last_read_at: null,
  });
}

/**
 * The whole membership state machine — status, door policy, invites, bans —
 * is decided server-side by join_scene(). Returns the resulting status so the
 * UI can show "You're in" vs "Waiting on approval" without a refetch.
 */
export async function joinScene(sceneId: string, profileId: string): Promise<SceneMemberStatus> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_scene", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
  });
  if (error) throw error;
  return data as SceneMemberStatus;
}

export async function leaveScene(sceneId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("leave_scene", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
  });
  if (error) throw error;
}

/** Declining an invite is the caller updating their own row — no RPC needed. */
export async function declineSceneInvite(sceneId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scene_members")
    .update({ status: "left" })
    .eq("scene_id", sceneId)
    .eq("profile_id", profileId);
  if (error) throw error;
}
