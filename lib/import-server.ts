/**
 * Shared server helpers for Import Studio routes.
 *
 * SERVER ONLY — imports the service-role client. Follows the same shape as
 * lib/invite-server.ts: resolve to a typed context or null, fail closed, and
 * hand the routes something they can act on without re-checking ownership.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { WorkspaceImportPlan } from "@/lib/ai/import-plan-schema";

export type ImportStatus =
  | "draft"
  | "extracting"
  | "synthesizing"
  | "needs_review"
  | "committing"
  | "completed"
  | "failed"
  | "cancelled";

export type ImportSourceRow = {
  id: string;
  import_id: string;
  kind: "text" | "voice" | "image" | "document";
  label: string | null;
  storage_path: string | null;
  byte_size: number | null;
  mime_type: string | null;
  extracted_text: string | null;
  status: "pending" | "extracting" | "ready" | "failed" | "excluded";
  error: string | null;
  sort: number;
  created_at: string;
};

export type ImportRow = {
  id: string;
  user_id: string;
  status: ImportStatus;
  plan: WorkspaceImportPlan | null;
  summary: Record<string, unknown> | null;
  model: string | null;
  error: string | null;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/** Imports hold pre-commit catalog data — one generic message for every failure. */
export const IMPORT_UNAVAILABLE_MESSAGE = "That import isn’t available.";

export type ImportContext = {
  userId: string;
  imp: ImportRow;
  admin: ReturnType<typeof createAdminClient>;
};

/**
 * Resolves the signed-in user and the import they're asking about, confirming
 * they own it. Returns null for missing, not-yours, or any failure — callers
 * must not distinguish those to the client.
 */
export async function resolveImport(importId: string): Promise<ImportContext | null> {
  if (typeof importId !== "string" || importId.length < 10) return null;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("onboarding_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.user_id !== user.id) return null;

  return { userId: user.id, imp: data as ImportRow, admin };
}

/** The signed-in user, or null. For routes that don't have an import id yet. */
export async function currentUserId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function setImportStatus(
  admin: ReturnType<typeof createAdminClient>,
  importId: string,
  status: ImportStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await admin
    .from("onboarding_imports")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", importId);
}

/**
 * Reads the artist's current catalog so the model proposes slotting into what
 * they already have rather than inventing parallel spaces.
 */
export async function loadWorkspaceContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const [spacesRes, tracksRes, projectsRes] = await Promise.all([
    admin.from("spaces").select("id, name").eq("user_id", userId).order("sort"),
    admin.from("tracks").select("title").eq("user_id", userId).limit(500),
    admin.from("projects").select("name").eq("user_id", userId).limit(200),
  ]);

  const spaces = spacesRes.data ?? [];
  const spaceIds = spaces.map((s) => s.id);

  const stagesRes = spaceIds.length
    ? await admin.from("stages").select("space_id, name, sort").in("space_id", spaceIds).order("sort")
    : { data: [] as { space_id: string; name: string; sort: number }[] };

  const stagesBySpace = new Map<string, string[]>();
  for (const stage of stagesRes.data ?? []) {
    const list = stagesBySpace.get(stage.space_id) ?? [];
    list.push(stage.name);
    stagesBySpace.set(stage.space_id, list);
  }

  return {
    existingSpaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      stageNames: stagesBySpace.get(s.id) ?? [],
    })),
    existingTrackTitles: (tracksRes.data ?? []).map((t) => t.title),
    existingProjectNames: (projectsRes.data ?? []).map((p) => p.name),
  };
}

/** Deletes an import's uploaded source files from storage. Best effort. */
export async function deleteImportFiles(
  admin: ReturnType<typeof createAdminClient>,
  importId: string,
): Promise<void> {
  const { data: sources } = await admin
    .from("onboarding_sources")
    .select("storage_path")
    .eq("import_id", importId);

  const paths = (sources ?? [])
    .map((s) => s.storage_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  if (paths.length === 0) return;

  const { error } = await admin.storage.from("audio").remove(paths);
  if (error) {
    console.error("[import] failed to remove source files:", error.message);
  }
}

/** How many imports this user has synthesized recently — this endpoint costs money. */
export const SYNTHESIZE_BURST_LIMIT = 20;
export const SYNTHESIZE_BURST_WINDOW_MS = 60 * 60 * 1000;

export async function synthesizeBurstExceeded(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - SYNTHESIZE_BURST_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("onboarding_imports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("updated_at", since)
    .in("status", ["needs_review", "synthesizing", "completed"]);

  return (count ?? 0) >= SYNTHESIZE_BURST_LIMIT;
}
