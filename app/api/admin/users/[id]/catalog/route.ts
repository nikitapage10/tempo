import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import {
  readSnapshotIndex,
  snapshotUserCatalog,
} from "@/lib/catalog-backup/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

/**
 * GET /api/admin/users/[id]/catalog
 *
 * Opaque backup status only — dates, sizes, row counts. Never returns catalog
 * contents (titles, notes, paths). Admins recover via Supabase DB backups or by
 * asking the member to export/restore from Settings → Your data.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  try {
    const service = createAdminClient();
    const { data } = await service.auth.admin.getUserById(params.id);
    if (!data.user) return adminError("Member not found.", 404);

    const index = await readSnapshotIndex(service, params.id);
    return adminJson({
      userId: params.id,
      updatedAt: index.updatedAt,
      snapshots: index.snapshots.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        bytes: s.bytes,
        source: s.source,
        trackCount: s.trackCount,
        projectCount: s.projectCount,
        spaceCount: s.spaceCount,
        schemaVersion: s.schemaVersion,
      })),
    });
  } catch (err) {
    console.error("[admin/catalog]", err);
    return adminError("Couldn’t load catalog backup status.", 500);
  }
}

/**
 * POST /api/admin/users/[id]/catalog — take a metadata snapshot now.
 * Does not return the dump body.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  try {
    const service = createAdminClient();
    const { data } = await service.auth.admin.getUserById(params.id);
    if (!data.user) return adminError("Member not found.", 404);

    const meta = await snapshotUserCatalog(service, params.id, "manual");
    await logAdminAction(
      access.user.id,
      "member.catalog_snapshot",
      { type: "user", id: params.id },
      {
        snapshotId: meta.id,
        createdAt: meta.createdAt,
        bytes: meta.bytes,
        trackCount: meta.trackCount,
      },
    );

    return adminJson({
      ok: true,
      snapshot: {
        id: meta.id,
        createdAt: meta.createdAt,
        bytes: meta.bytes,
        source: meta.source,
        trackCount: meta.trackCount,
        projectCount: meta.projectCount,
        spaceCount: meta.spaceCount,
      },
    });
  } catch (err) {
    console.error("[admin/catalog] snapshot", err);
    return adminError("Couldn’t save a catalog snapshot.", 500);
  }
}
